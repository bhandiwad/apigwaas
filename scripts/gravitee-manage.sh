#!/usr/bin/env bash
# ============================================================================
# Gravitee APIM Management Script
# Manage Gravitee gateway lifecycle, upgrades, backups, and health checks
# Usage: ./scripts/gravitee-manage.sh [action] [environment] [args...]
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ACTION="${1:-help}"
ENVIRONMENT="${2:-staging}"
GW_NAMESPACE="gravitee-${ENVIRONMENT}"

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }

# ─── Health Check ─────────────────────────────────────────────────────────────

health() {
  log "Checking Gravitee APIM health in ${ENVIRONMENT}..."
  echo ""

  echo "=== Gateway Pods ==="
  kubectl get pods -n "$GW_NAMESPACE" -l component=gateway \
    -o custom-columns="NAME:.metadata.name,STATUS:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount,AGE:.metadata.creationTimestamp"

  echo ""
  echo "=== Management API Pods ==="
  kubectl get pods -n "$GW_NAMESPACE" -l component=management-api \
    -o custom-columns="NAME:.metadata.name,STATUS:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount,AGE:.metadata.creationTimestamp"

  echo ""
  echo "=== Resource Usage ==="
  kubectl top pods -n "$GW_NAMESPACE" 2>/dev/null || warn "Metrics server not available"

  echo ""
  echo "=== Gateway Health Endpoint ==="
  local GW_POD=$(kubectl get pods -n "$GW_NAMESPACE" -l component=gateway -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
  if [[ -n "$GW_POD" ]]; then
    kubectl exec -n "$GW_NAMESPACE" "$GW_POD" -- curl -sf http://localhost:18082/_node/health 2>/dev/null || warn "Health endpoint unreachable"
  fi
}

# ─── Upgrade ──────────────────────────────────────────────────────────────────

upgrade() {
  local VERSION="${3:-latest}"
  log "Upgrading Gravitee APIM to version ${VERSION} in ${ENVIRONMENT}..."

  # Pre-upgrade backup
  backup

  # Rolling upgrade
  helm upgrade gravitee-apim \
    "${PROJECT_ROOT}/deploy/helm/gravitee-apim" \
    --namespace "$GW_NAMESPACE" \
    --set gateway.image.tag="$VERSION" \
    --set managementApi.image.tag="$VERSION" \
    --set portal.image.tag="$VERSION" \
    --wait \
    --timeout 600s

  # Verify
  kubectl rollout status deployment/gravitee-gateway -n "$GW_NAMESPACE" --timeout=120s
  kubectl rollout status deployment/gravitee-management-api -n "$GW_NAMESPACE" --timeout=120s

  success "Gravitee APIM upgraded to ${VERSION}"
}

# ─── Backup ───────────────────────────────────────────────────────────────────

backup() {
  log "Creating Gravitee backup for ${ENVIRONMENT}..."
  local TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  local BACKUP_NAME="gravitee-backup-${ENVIRONMENT}-${TIMESTAMP}"

  # MongoDB backup via mongodump
  local MONGO_POD=$(kubectl get pods -n "$GW_NAMESPACE" -l component=mongodb -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
  if [[ -n "$MONGO_POD" ]]; then
    kubectl exec -n "$GW_NAMESPACE" "$MONGO_POD" -- \
      mongodump --archive="/tmp/${BACKUP_NAME}.archive" --gzip --db=gravitee

    kubectl cp "$GW_NAMESPACE/${MONGO_POD}:/tmp/${BACKUP_NAME}.archive" \
      "/tmp/${BACKUP_NAME}.archive"

    # Upload to S3
    aws s3 cp "/tmp/${BACKUP_NAME}.archive" \
      "s3://cloudinfinit-apigw-${ENVIRONMENT}-backups/gravitee/${BACKUP_NAME}.archive"

    success "Backup uploaded to S3: gravitee/${BACKUP_NAME}.archive"
  else
    warn "MongoDB pod not found, skipping database backup"
  fi

  # Helm release backup
  helm get values gravitee-apim -n "$GW_NAMESPACE" > "/tmp/${BACKUP_NAME}-values.yaml" 2>/dev/null
  aws s3 cp "/tmp/${BACKUP_NAME}-values.yaml" \
    "s3://cloudinfinit-apigw-${ENVIRONMENT}-backups/gravitee/${BACKUP_NAME}-values.yaml" 2>/dev/null || true
}

# ─── Restore ──────────────────────────────────────────────────────────────────

restore() {
  local BACKUP_FILE="${3:-}"
  [[ -z "$BACKUP_FILE" ]] && error "Usage: $0 restore [environment] [backup-file-name]"

  log "Restoring Gravitee from backup: ${BACKUP_FILE}..."
  warn "This will overwrite the current Gravitee database!"
  read -p "Type 'yes' to confirm: " confirm
  [[ "$confirm" == "yes" ]] || error "Aborted."

  # Download from S3
  aws s3 cp "s3://cloudinfinit-apigw-${ENVIRONMENT}-backups/gravitee/${BACKUP_FILE}" "/tmp/${BACKUP_FILE}"

  # Restore to MongoDB
  local MONGO_POD=$(kubectl get pods -n "$GW_NAMESPACE" -l component=mongodb -o jsonpath='{.items[0].metadata.name}')
  kubectl cp "/tmp/${BACKUP_FILE}" "$GW_NAMESPACE/${MONGO_POD}:/tmp/${BACKUP_FILE}"
  kubectl exec -n "$GW_NAMESPACE" "$MONGO_POD" -- \
    mongorestore --archive="/tmp/${BACKUP_FILE}" --gzip --drop --db=gravitee

  # Restart services to pick up restored data
  kubectl rollout restart deployment/gravitee-gateway -n "$GW_NAMESPACE"
  kubectl rollout restart deployment/gravitee-management-api -n "$GW_NAMESPACE"

  success "Gravitee restored from ${BACKUP_FILE}"
}

# ─── Scale Gateway ────────────────────────────────────────────────────────────

scale_gateway() {
  local REPLICAS="${3:-3}"
  log "Scaling Gravitee Gateway to ${REPLICAS} replicas..."

  kubectl scale deployment/gravitee-gateway \
    --replicas="$REPLICAS" \
    --namespace "$GW_NAMESPACE"

  kubectl rollout status deployment/gravitee-gateway -n "$GW_NAMESPACE" --timeout=120s
  success "Gateway scaled to ${REPLICAS} replicas"
}

# ─── Logs ─────────────────────────────────────────────────────────────────────

logs() {
  local COMPONENT="${3:-gateway}"
  log "Streaming ${COMPONENT} logs from ${ENVIRONMENT}..."

  kubectl logs -f -n "$GW_NAMESPACE" -l "component=${COMPONENT}" --tail=100 --all-containers
}

# ─── Restart ──────────────────────────────────────────────────────────────────

restart() {
  local COMPONENT="${3:-all}"
  log "Restarting Gravitee ${COMPONENT} in ${ENVIRONMENT}..."

  case "$COMPONENT" in
    gateway)
      kubectl rollout restart deployment/gravitee-gateway -n "$GW_NAMESPACE"
      ;;
    api|management)
      kubectl rollout restart deployment/gravitee-management-api -n "$GW_NAMESPACE"
      ;;
    all)
      kubectl rollout restart deployment/gravitee-gateway -n "$GW_NAMESPACE"
      kubectl rollout restart deployment/gravitee-management-api -n "$GW_NAMESPACE"
      ;;
    *)
      error "Unknown component: $COMPONENT. Use: gateway, api, all"
      ;;
  esac

  success "Restart initiated for ${COMPONENT}"
}

# ─── Configuration ────────────────────────────────────────────────────────────

config() {
  log "Current Gravitee configuration in ${ENVIRONMENT}:"
  echo ""
  helm get values gravitee-apim -n "$GW_NAMESPACE" 2>/dev/null || warn "No Helm release found"
}

# ─── API Sync Status ─────────────────────────────────────────────────────────

sync_status() {
  log "Checking API sync status..."

  local MGMT_POD=$(kubectl get pods -n "$GW_NAMESPACE" -l component=management-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
  if [[ -n "$MGMT_POD" ]]; then
    echo "=== APIs ==="
    kubectl exec -n "$GW_NAMESPACE" "$MGMT_POD" -- \
      curl -sf http://localhost:8083/management/organizations/DEFAULT/environments/DEFAULT/apis 2>/dev/null | \
      python3 -c "import json,sys; data=json.load(sys.stdin); print(f'Total APIs: {len(data.get(\"data\", []))}')" 2>/dev/null || warn "Cannot query Management API"
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────

case "$ACTION" in
  health)       health ;;
  upgrade)      upgrade "$@" ;;
  backup)       backup ;;
  restore)      restore "$@" ;;
  scale)        scale_gateway "$@" ;;
  logs)         logs "$@" ;;
  restart)      restart "$@" ;;
  config)       config ;;
  sync)         sync_status ;;
  help|*)
    echo "Gravitee APIM Management Script"
    echo ""
    echo "Usage: $0 [action] [environment] [args...]"
    echo ""
    echo "Actions:"
    echo "  health              - Check Gravitee health and pod status"
    echo "  upgrade [version]   - Upgrade Gravitee to specified version"
    echo "  backup              - Create MongoDB backup and upload to S3"
    echo "  restore [file]      - Restore from S3 backup file"
    echo "  scale [replicas]    - Scale gateway replicas"
    echo "  logs [component]    - Stream logs (gateway|api)"
    echo "  restart [component] - Restart component (gateway|api|all)"
    echo "  config              - Show current Helm values"
    echo "  sync                - Check API sync status"
    echo ""
    echo "Environments: staging, production"
    ;;
esac
