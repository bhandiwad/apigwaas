#!/usr/bin/env bash
# ============================================================================
# CloudInfinit API Gateway - Infrastructure Provisioning
# One-command AWS infrastructure setup using Terraform
# Usage: ./scripts/infra-provision.sh [environment] [action]
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TF_DIR="${PROJECT_ROOT}/deploy/terraform"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT="${1:-staging}"
ACTION="${2:-plan}"

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }

# ─── Validation ───────────────────────────────────────────────────────────────

validate() {
  command -v terraform >/dev/null 2>&1 || error "Terraform is required. Install: https://developer.hashicorp.com/terraform/install"
  command -v aws >/dev/null 2>&1 || error "AWS CLI is required. Install: https://aws.amazon.com/cli/"

  aws sts get-caller-identity >/dev/null 2>&1 || error "AWS credentials not configured. Run: aws configure"

  [[ -f "${TF_DIR}/environments/${ENVIRONMENT}.tfvars" ]] || error "No tfvars file for environment: ${ENVIRONMENT}"
}

# ─── Terraform Operations ─────────────────────────────────────────────────────

tf_init() {
  log "Initializing Terraform..."
  cd "$TF_DIR"

  terraform init \
    -backend-config="bucket=cloudinfinit-terraform-state" \
    -backend-config="key=${ENVIRONMENT}/terraform.tfstate" \
    -backend-config="region=ap-south-1" \
    -backend-config="encrypt=true"

  success "Terraform initialized"
}

tf_plan() {
  log "Planning infrastructure for ${ENVIRONMENT}..."
  cd "$TF_DIR"

  terraform plan \
    -var-file="environments/${ENVIRONMENT}.tfvars" \
    -out="tfplan-${ENVIRONMENT}"

  success "Plan saved to tfplan-${ENVIRONMENT}"
}

tf_apply() {
  log "Applying infrastructure for ${ENVIRONMENT}..."
  cd "$TF_DIR"

  if [[ -f "tfplan-${ENVIRONMENT}" ]]; then
    terraform apply "tfplan-${ENVIRONMENT}"
  else
    warn "No saved plan found. Running plan + apply..."
    terraform apply \
      -var-file="environments/${ENVIRONMENT}.tfvars" \
      -auto-approve
  fi

  success "Infrastructure provisioned for ${ENVIRONMENT}"

  echo ""
  log "Outputs:"
  terraform output
}

tf_destroy() {
  warn "This will DESTROY all infrastructure in ${ENVIRONMENT}!"
  warn "This includes: EKS cluster, RDS, DocumentDB, ElastiCache, OpenSearch"
  read -p "Type the environment name to confirm: " confirm
  [[ "$confirm" == "$ENVIRONMENT" ]] || error "Aborted."

  cd "$TF_DIR"
  terraform destroy \
    -var-file="environments/${ENVIRONMENT}.tfvars" \
    -auto-approve

  success "Infrastructure destroyed for ${ENVIRONMENT}"
}

tf_output() {
  cd "$TF_DIR"
  terraform output -json
}

# ─── Post-Provision Setup ─────────────────────────────────────────────────────

post_provision() {
  log "Running post-provisioning setup..."

  # Get EKS cluster name and configure kubectl
  local CLUSTER_NAME=$(cd "$TF_DIR" && terraform output -raw eks_cluster_name 2>/dev/null)
  if [[ -n "$CLUSTER_NAME" ]]; then
    aws eks update-kubeconfig --name "$CLUSTER_NAME" --region ap-south-1
    success "kubectl configured for ${CLUSTER_NAME}"
  fi

  # Install cluster add-ons
  log "Installing cluster add-ons..."

  # Nginx Ingress Controller
  helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
  helm repo update
  helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx --create-namespace \
    --set controller.service.type=LoadBalancer \
    --set controller.metrics.enabled=true \
    --wait 2>/dev/null && success "Nginx Ingress installed" || warn "Nginx Ingress installation skipped"

  # Cert-Manager for TLS
  helm repo add jetstack https://charts.jetstack.io 2>/dev/null || true
  helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace cert-manager --create-namespace \
    --set installCRDs=true \
    --wait 2>/dev/null && success "cert-manager installed" || warn "cert-manager installation skipped"

  # External Secrets Operator
  helm repo add external-secrets https://charts.external-secrets.io 2>/dev/null || true
  helm upgrade --install external-secrets external-secrets/external-secrets \
    --namespace external-secrets --create-namespace \
    --wait 2>/dev/null && success "External Secrets Operator installed" || warn "ESO installation skipped"

  success "Post-provisioning complete"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

case "$ACTION" in
  init)
    validate
    tf_init
    ;;
  plan)
    validate
    tf_init
    tf_plan
    ;;
  apply)
    validate
    tf_init
    tf_apply
    post_provision
    ;;
  destroy)
    validate
    tf_init
    tf_destroy
    ;;
  output)
    tf_output
    ;;
  *)
    echo "CloudInfinit API Gateway - Infrastructure Provisioning"
    echo ""
    echo "Usage: $0 [environment] [action]"
    echo ""
    echo "Environments: staging, production"
    echo ""
    echo "Actions:"
    echo "  init    - Initialize Terraform backend"
    echo "  plan    - Plan infrastructure changes (default)"
    echo "  apply   - Apply infrastructure + install cluster add-ons"
    echo "  destroy - Destroy all infrastructure (requires confirmation)"
    echo "  output  - Show Terraform outputs"
    echo ""
    echo "Prerequisites:"
    echo "  - AWS CLI configured with appropriate credentials"
    echo "  - Terraform >= 1.7.0 installed"
    echo "  - S3 bucket 'cloudinfinit-terraform-state' created for state"
    ;;
esac
