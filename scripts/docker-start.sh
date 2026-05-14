#!/usr/bin/env bash
# ============================================================================
# CloudInfinit API Gateway - Docker Compose Quick Start
# One-command local deployment with all services
# Usage: ./scripts/docker-start.sh [mode]
# Modes: dev (default), prod, monitoring, full
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="${PROJECT_ROOT}/deploy/docker"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

MODE="${1:-dev}"

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# ─── Environment Setup ────────────────────────────────────────────────────────

setup_env() {
  if [[ ! -f "${DOCKER_DIR}/.env" ]]; then
    log "Creating .env from template..."
    cp "${DOCKER_DIR}/.env.template" "${DOCKER_DIR}/.env"
    warn "Edit ${DOCKER_DIR}/.env with your configuration before production use"
  fi
}

# ─── Start Services ──────────────────────────────────────────────────────────

start_dev() {
  log "Starting development stack (hot-reload enabled)..."
  docker compose -f "${DOCKER_DIR}/docker-compose.yml" \
                 -f "${DOCKER_DIR}/docker-compose.dev.yml" \
                 up -d --build

  echo ""
  success "Development stack is running!"
  echo ""
  echo -e "  ${CYAN}Platform:${NC}     http://localhost:3000"
  echo -e "  ${CYAN}Gravitee GW:${NC}  http://localhost:8082"
  echo -e "  ${CYAN}Gravitee UI:${NC}  http://localhost:8084"
  echo -e "  ${CYAN}Gravitee API:${NC} http://localhost:8083"
  echo ""
  echo "  Hot-reload is active. Edit files and see changes instantly."
}

start_prod() {
  log "Starting production stack..."
  docker compose -f "${DOCKER_DIR}/docker-compose.yml" up -d --build

  echo ""
  success "Production stack is running!"
  echo ""
  echo -e "  ${CYAN}Platform:${NC}     http://localhost (via Nginx)"
  echo -e "  ${CYAN}Gravitee GW:${NC}  http://localhost:8082"
  echo -e "  ${CYAN}Gravitee UI:${NC}  http://localhost:8084"
  echo -e "  ${CYAN}Gravitee API:${NC} http://localhost:8083"
}

start_monitoring() {
  log "Starting with monitoring stack..."
  docker compose -f "${DOCKER_DIR}/docker-compose.yml" \
                 -f "${DOCKER_DIR}/docker-compose.monitoring.yml" \
                 up -d --build

  echo ""
  success "Full stack with monitoring is running!"
  echo ""
  echo -e "  ${CYAN}Platform:${NC}      http://localhost (via Nginx)"
  echo -e "  ${CYAN}Gravitee GW:${NC}   http://localhost:8082"
  echo -e "  ${CYAN}Gravitee UI:${NC}   http://localhost:8084"
  echo -e "  ${CYAN}Prometheus:${NC}    http://localhost:9090"
  echo -e "  ${CYAN}Grafana:${NC}       http://localhost:3001 (admin/admin)"
  echo -e "  ${CYAN}AlertManager:${NC}  http://localhost:9093"
}

start_full() {
  log "Starting full stack (prod + monitoring)..."
  docker compose -f "${DOCKER_DIR}/docker-compose.yml" \
                 -f "${DOCKER_DIR}/docker-compose.monitoring.yml" \
                 up -d --build

  echo ""
  success "Full production + monitoring stack is running!"
  echo ""
  echo -e "  ${CYAN}Platform:${NC}      http://localhost"
  echo -e "  ${CYAN}Gravitee GW:${NC}   http://localhost:8082"
  echo -e "  ${CYAN}Gravitee UI:${NC}   http://localhost:8084"
  echo -e "  ${CYAN}Gravitee API:${NC}  http://localhost:8083"
  echo -e "  ${CYAN}Prometheus:${NC}    http://localhost:9090"
  echo -e "  ${CYAN}Grafana:${NC}       http://localhost:3001"
  echo -e "  ${CYAN}AlertManager:${NC}  http://localhost:9093"
}

# ─── Stop Services ────────────────────────────────────────────────────────────

stop() {
  log "Stopping all services..."
  docker compose -f "${DOCKER_DIR}/docker-compose.yml" \
                 -f "${DOCKER_DIR}/docker-compose.dev.yml" \
                 -f "${DOCKER_DIR}/docker-compose.monitoring.yml" \
                 down 2>/dev/null || true
  success "All services stopped"
}

# ─── Status ───────────────────────────────────────────────────────────────────

status() {
  log "Service status:"
  docker compose -f "${DOCKER_DIR}/docker-compose.yml" ps 2>/dev/null || warn "No services running"
}

# ─── Logs ─────────────────────────────────────────────────────────────────────

show_logs() {
  local SERVICE="${2:-}"
  if [[ -n "$SERVICE" ]]; then
    docker compose -f "${DOCKER_DIR}/docker-compose.yml" logs -f "$SERVICE"
  else
    docker compose -f "${DOCKER_DIR}/docker-compose.yml" logs -f --tail=50
  fi
}

# ─── Clean ────────────────────────────────────────────────────────────────────

clean() {
  warn "This will remove all containers, volumes, and data!"
  read -p "Type 'yes' to confirm: " confirm
  [[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 0; }

  docker compose -f "${DOCKER_DIR}/docker-compose.yml" \
                 -f "${DOCKER_DIR}/docker-compose.dev.yml" \
                 -f "${DOCKER_DIR}/docker-compose.monitoring.yml" \
                 down -v --remove-orphans 2>/dev/null || true

  success "All containers, volumes, and data removed"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

case "$MODE" in
  dev)        setup_env; start_dev ;;
  prod)       setup_env; start_prod ;;
  monitoring) setup_env; start_monitoring ;;
  full)       setup_env; start_full ;;
  stop)       stop ;;
  status)     status ;;
  logs)       show_logs "$@" ;;
  clean)      clean ;;
  *)
    echo "CloudInfinit API Gateway - Docker Quick Start"
    echo ""
    echo "Usage: $0 [mode]"
    echo ""
    echo "Modes:"
    echo "  dev         - Development with hot-reload (default)"
    echo "  prod        - Production-like deployment"
    echo "  monitoring  - Production + Prometheus/Grafana"
    echo "  full        - Everything (prod + monitoring)"
    echo "  stop        - Stop all services"
    echo "  status      - Show service status"
    echo "  logs [svc]  - Stream logs (optional: service name)"
    echo "  clean       - Remove all data and volumes"
    ;;
esac
