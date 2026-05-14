#!/usr/bin/env bash
# ============================================================================
# CloudInfinit API Gateway - Deployment Script
# Usage: ./scripts/deploy.sh [environment] [action]
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Defaults
ENVIRONMENT="${1:-staging}"
ACTION="${2:-deploy}"
REGISTRY="${REGISTRY:-ghcr.io/bhandiwad/apigwaas}"
NAMESPACE="cloudinfinit-${ENVIRONMENT}"

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }

# ─── Validation ───────────────────────────────────────────────────────────────

validate_environment() {
  case "$ENVIRONMENT" in
    staging|production) ;;
    *) error "Invalid environment: $ENVIRONMENT. Use 'staging' or 'production'." ;;
  esac
}

validate_prerequisites() {
  local tools=("kubectl" "helm" "docker" "aws")
  for tool in "${tools[@]}"; do
    command -v "$tool" >/dev/null 2>&1 || error "$tool is required but not installed."
  done

  # Verify cluster connectivity
  kubectl cluster-info >/dev/null 2>&1 || error "Cannot connect to Kubernetes cluster. Run: aws eks update-kubeconfig --name cloudinfinit-apigw-${ENVIRONMENT}"
}

# ─── Docker Build ─────────────────────────────────────────────────────────────

build_image() {
  log "Building Docker image..."
  local TAG="${REGISTRY}:$(git rev-parse --short HEAD)"
  local LATEST="${REGISTRY}:latest"

  docker build \
    -f "${PROJECT_ROOT}/deploy/docker/Dockerfile" \
    -t "$TAG" \
    -t "$LATEST" \
    --build-arg NODE_ENV=production \
    "$PROJECT_ROOT"

  success "Image built: $TAG"
  echo "$TAG"
}

push_image() {
  log "Pushing Docker image to registry..."
  local TAG="${REGISTRY}:$(git rev-parse --short HEAD)"

  docker push "$TAG"
  docker push "${REGISTRY}:latest"

  success "Image pushed: $TAG"
}

# ─── Helm Deploy ─────────────────────────────────────────────────────────────

deploy_platform() {
  log "Deploying CloudInfinit platform to ${ENVIRONMENT}..."
  local TAG="$(git rev-parse --short HEAD)"
  local VALUES_FILE="${PROJECT_ROOT}/deploy/helm/cloudinfinit-apigw/values-${ENVIRONMENT}.yaml"

  local VALUES_FLAG=""
  [[ -f "$VALUES_FILE" ]] && VALUES_FLAG="--values $VALUES_FILE"

  helm upgrade --install cloudinfinit-apigw \
    "${PROJECT_ROOT}/deploy/helm/cloudinfinit-apigw" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    $VALUES_FLAG \
    --set platform.image.repository="$REGISTRY" \
    --set platform.image.tag="$TAG" \
    --set platform.env.NODE_ENV="$ENVIRONMENT" \
    --set environment="$ENVIRONMENT" \
    --wait \
    --timeout 300s

  success "Platform deployed to ${ENVIRONMENT}"
}

deploy_gravitee() {
  log "Deploying Gravitee APIM to ${ENVIRONMENT}..."
  local GW_NAMESPACE="gravitee-${ENVIRONMENT}"

  local REPLICAS=2
  [[ "$ENVIRONMENT" == "production" ]] && REPLICAS=5

  helm upgrade --install gravitee-apim \
    "${PROJECT_ROOT}/deploy/helm/gravitee-apim" \
    --namespace "$GW_NAMESPACE" \
    --create-namespace \
    --set gateway.replicaCount="$REPLICAS" \
    --set managementApi.replicaCount=$(( REPLICAS / 2 + 1 )) \
    --wait \
    --timeout 600s

  success "Gravitee APIM deployed to ${ENVIRONMENT}"
}

# ─── Rollback ─────────────────────────────────────────────────────────────────

rollback() {
  local REVISION="${1:-}"
  log "Rolling back deployment in ${ENVIRONMENT}..."

  if [[ -n "$REVISION" ]]; then
    helm rollback cloudinfinit-apigw "$REVISION" --namespace "$NAMESPACE"
  else
    helm rollback cloudinfinit-apigw --namespace "$NAMESPACE"
  fi

  success "Rollback complete"
}

# ─── Scale ────────────────────────────────────────────────────────────────────

scale() {
  local REPLICAS="${1:-3}"
  log "Scaling platform to ${REPLICAS} replicas..."

  kubectl scale deployment/cloudinfinit-apigw \
    --replicas="$REPLICAS" \
    --namespace "$NAMESPACE"

  success "Scaled to ${REPLICAS} replicas"
}

# ─── Status ───────────────────────────────────────────────────────────────────

status() {
  log "Deployment status for ${ENVIRONMENT}:"
  echo ""
  echo "=== Platform ==="
  kubectl get pods -n "$NAMESPACE" -l app=cloudinfinit-apigw 2>/dev/null || warn "No platform pods found"
  echo ""
  echo "=== Gravitee ==="
  kubectl get pods -n "gravitee-${ENVIRONMENT}" 2>/dev/null || warn "No Gravitee pods found"
  echo ""
  echo "=== Ingress ==="
  kubectl get ingress -n "$NAMESPACE" 2>/dev/null || warn "No ingress found"
  echo ""
  echo "=== Helm Releases ==="
  helm list -n "$NAMESPACE" 2>/dev/null
  helm list -n "gravitee-${ENVIRONMENT}" 2>/dev/null
}

# ─── Destroy ──────────────────────────────────────────────────────────────────

destroy() {
  warn "This will destroy all resources in ${ENVIRONMENT}!"
  read -p "Type 'yes' to confirm: " confirm
  [[ "$confirm" == "yes" ]] || error "Aborted."

  helm uninstall cloudinfinit-apigw --namespace "$NAMESPACE" 2>/dev/null || true
  helm uninstall gravitee-apim --namespace "gravitee-${ENVIRONMENT}" 2>/dev/null || true
  kubectl delete namespace "$NAMESPACE" 2>/dev/null || true
  kubectl delete namespace "gravitee-${ENVIRONMENT}" 2>/dev/null || true

  success "All resources destroyed in ${ENVIRONMENT}"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
  validate_environment

  case "$ACTION" in
    deploy)
      validate_prerequisites
      build_image
      push_image
      deploy_platform
      deploy_gravitee
      ;;
    build)
      build_image
      ;;
    push)
      push_image
      ;;
    platform)
      validate_prerequisites
      deploy_platform
      ;;
    gravitee)
      validate_prerequisites
      deploy_gravitee
      ;;
    rollback)
      validate_prerequisites
      rollback "${3:-}"
      ;;
    scale)
      validate_prerequisites
      scale "${3:-3}"
      ;;
    status)
      validate_prerequisites
      status
      ;;
    destroy)
      validate_prerequisites
      destroy
      ;;
    *)
      echo "Usage: $0 [environment] [action] [args...]"
      echo ""
      echo "Environments: staging, production"
      echo ""
      echo "Actions:"
      echo "  deploy    - Full deployment (build + push + deploy platform + gravitee)"
      echo "  build     - Build Docker image only"
      echo "  push      - Push Docker image to registry"
      echo "  platform  - Deploy platform only"
      echo "  gravitee  - Deploy Gravitee APIM only"
      echo "  rollback  - Rollback to previous release (optional: revision number)"
      echo "  scale     - Scale platform replicas (optional: count, default 3)"
      echo "  status    - Show deployment status"
      echo "  destroy   - Destroy all resources (requires confirmation)"
      ;;
  esac
}

main "$@"
