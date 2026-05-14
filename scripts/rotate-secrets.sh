#!/usr/bin/env bash
# ============================================================================
# CloudInfinit API Gateway - Secret Rotation Script
# Rotates application secrets and updates Kubernetes secrets
# Usage: ./scripts/rotate-secrets.sh [environment] [secret-type]
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT="${1:-staging}"
SECRET_TYPE="${2:-all}"

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }

NAMESPACE="cloudinfinit-${ENVIRONMENT}"

# ─── Validation ───────────────────────────────────────────────────────────────

validate() {
  command -v kubectl >/dev/null 2>&1 || error "kubectl is required"
  command -v aws >/dev/null 2>&1 || error "AWS CLI is required"
  kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || error "Namespace $NAMESPACE not found"
}

# ─── Secret Generation ────────────────────────────────────────────────────────

generate_jwt_secret() {
  openssl rand -base64 64 | tr -d '\n'
}

generate_db_password() {
  openssl rand -base64 32 | tr -d '/+=' | head -c 32
}

generate_api_key() {
  openssl rand -hex 32
}

# ─── Rotation Functions ───────────────────────────────────────────────────────

rotate_jwt_secret() {
  log "Rotating JWT secret..."
  
  local NEW_SECRET=$(generate_jwt_secret)
  local SECRET_NAME="cloudinfinit-${ENVIRONMENT}-secrets"
  
  # Update in AWS Secrets Manager
  aws secretsmanager update-secret \
    --secret-id "cloudinfinit/${ENVIRONMENT}/jwt-secret" \
    --secret-string "$NEW_SECRET" \
    --region ap-south-1 2>/dev/null || \
  aws secretsmanager create-secret \
    --name "cloudinfinit/${ENVIRONMENT}/jwt-secret" \
    --secret-string "$NEW_SECRET" \
    --region ap-south-1

  # Update Kubernetes secret
  kubectl create secret generic "$SECRET_NAME" \
    --from-literal=JWT_SECRET="$NEW_SECRET" \
    --namespace "$NAMESPACE" \
    --dry-run=client -o yaml | kubectl apply -f -

  # Restart pods to pick up new secret
  kubectl rollout restart deployment/cloudinfinit-apigw -n "$NAMESPACE"
  
  success "JWT secret rotated. Pods restarting."
  warn "Active sessions will be invalidated."
}

rotate_gravitee_token() {
  log "Rotating Gravitee API token..."
  warn "This requires generating a new token in Gravitee Console."
  warn "Steps:"
  echo "  1. Log in to Gravitee Console"
  echo "  2. Go to User Settings → Tokens"
  echo "  3. Revoke the old token"
  echo "  4. Generate a new token"
  echo ""
  read -p "Enter new Gravitee API token: " NEW_TOKEN
  [[ -n "$NEW_TOKEN" ]] || error "Token cannot be empty"

  local SECRET_NAME="cloudinfinit-${ENVIRONMENT}-secrets"

  # Update in AWS Secrets Manager
  aws secretsmanager update-secret \
    --secret-id "cloudinfinit/${ENVIRONMENT}/gravitee-token" \
    --secret-string "$NEW_TOKEN" \
    --region ap-south-1 2>/dev/null || \
  aws secretsmanager create-secret \
    --name "cloudinfinit/${ENVIRONMENT}/gravitee-token" \
    --secret-string "$NEW_TOKEN" \
    --region ap-south-1

  # Update Kubernetes secret
  kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o json | \
    jq --arg token "$(echo -n "$NEW_TOKEN" | base64)" '.data.GRAVITEE_API_TOKEN = $token' | \
    kubectl apply -f -

  kubectl rollout restart deployment/cloudinfinit-apigw -n "$NAMESPACE"
  
  success "Gravitee API token rotated."
}

rotate_db_password() {
  log "Rotating database password..."
  warn "This will update the RDS master password. Ensure no active connections."
  
  local NEW_PASSWORD=$(generate_db_password)
  local DB_INSTANCE="cloudinfinit-apigw-${ENVIRONMENT}"

  # Update RDS password
  aws rds modify-db-instance \
    --db-instance-identifier "$DB_INSTANCE" \
    --master-user-password "$NEW_PASSWORD" \
    --apply-immediately \
    --region ap-south-1

  # Wait for modification
  log "Waiting for RDS modification to complete..."
  aws rds wait db-instance-available \
    --db-instance-identifier "$DB_INSTANCE" \
    --region ap-south-1

  # Get RDS endpoint
  local ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier "$DB_INSTANCE" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text \
    --region ap-south-1)

  local NEW_URL="mysql://cloudinfinit:${NEW_PASSWORD}@${ENDPOINT}:3306/cloudinfinit_apigw?ssl=true"

  # Update Kubernetes secret
  local SECRET_NAME="cloudinfinit-${ENVIRONMENT}-secrets"
  kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o json | \
    jq --arg url "$(echo -n "$NEW_URL" | base64)" '.data.DATABASE_URL = $url' | \
    kubectl apply -f -

  # Update AWS Secrets Manager
  aws secretsmanager update-secret \
    --secret-id "cloudinfinit/${ENVIRONMENT}/database-url" \
    --secret-string "$NEW_URL" \
    --region ap-south-1 2>/dev/null || true

  kubectl rollout restart deployment/cloudinfinit-apigw -n "$NAMESPACE"
  
  success "Database password rotated. New connection string applied."
}

rotate_all() {
  log "Rotating all secrets for ${ENVIRONMENT}..."
  rotate_jwt_secret
  rotate_db_password
  rotate_gravitee_token
  success "All secrets rotated for ${ENVIRONMENT}"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

case "$SECRET_TYPE" in
  jwt)
    validate
    rotate_jwt_secret
    ;;
  gravitee)
    validate
    rotate_gravitee_token
    ;;
  database|db)
    validate
    rotate_db_password
    ;;
  all)
    validate
    rotate_all
    ;;
  *)
    echo "CloudInfinit API Gateway - Secret Rotation"
    echo ""
    echo "Usage: $0 [environment] [secret-type]"
    echo ""
    echo "Environments: staging, production"
    echo ""
    echo "Secret Types:"
    echo "  jwt       - Rotate JWT signing secret (invalidates sessions)"
    echo "  gravitee  - Rotate Gravitee API token (interactive)"
    echo "  database  - Rotate RDS database password"
    echo "  all       - Rotate all secrets (default)"
    echo ""
    echo "Examples:"
    echo "  $0 staging jwt"
    echo "  $0 production all"
    ;;
esac
