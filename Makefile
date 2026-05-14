# ============================================================================
# CloudInfinit API Gateway - Makefile
# Production-grade deployment and management commands
# ============================================================================

.PHONY: help dev prod build test deploy status clean

# Default target
help: ## Show this help
	@echo "CloudInfinit API Gateway - Available Commands"
	@echo ""
	@echo "─── Local Development ───────────────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Local Development ────────────────────────────────────────────────────────

dev: ## Start development stack with hot-reload
	./scripts/docker-start.sh dev

prod: ## Start production-like stack locally
	./scripts/docker-start.sh prod

full: ## Start full stack (prod + monitoring)
	./scripts/docker-start.sh full

stop: ## Stop all Docker services
	./scripts/docker-start.sh stop

status: ## Show Docker service status
	./scripts/docker-start.sh status

logs: ## Stream all service logs
	./scripts/docker-start.sh logs

clean: ## Remove all containers and volumes
	./scripts/docker-start.sh clean

# ─── Build & Test ─────────────────────────────────────────────────────────────

build: ## Build Docker image
	./scripts/deploy.sh staging build

test: ## Run test suite
	pnpm test

typecheck: ## Run TypeScript type checking
	pnpm check

lint: ## Run linter
	pnpm format

# ─── Infrastructure ──────────────────────────────────────────────────────────

infra-plan-staging: ## Plan staging infrastructure
	./scripts/infra-provision.sh staging plan

infra-apply-staging: ## Provision staging infrastructure
	./scripts/infra-provision.sh staging apply

infra-plan-prod: ## Plan production infrastructure
	./scripts/infra-provision.sh production plan

infra-apply-prod: ## Provision production infrastructure
	./scripts/infra-provision.sh production apply

infra-destroy-staging: ## Destroy staging infrastructure
	./scripts/infra-provision.sh staging destroy

# ─── Deployment ───────────────────────────────────────────────────────────────

deploy-staging: ## Deploy to staging Kubernetes
	./scripts/deploy.sh staging deploy

deploy-prod: ## Deploy to production Kubernetes
	./scripts/deploy.sh production deploy

deploy-platform-staging: ## Deploy only platform to staging
	./scripts/deploy.sh staging platform

deploy-gravitee-staging: ## Deploy only Gravitee to staging
	./scripts/deploy.sh staging gravitee

rollback-staging: ## Rollback staging deployment
	./scripts/deploy.sh staging rollback

rollback-prod: ## Rollback production deployment
	./scripts/deploy.sh production rollback

scale-staging: ## Scale staging (usage: make scale-staging REPLICAS=5)
	./scripts/deploy.sh staging scale $(REPLICAS)

# ─── Gravitee Management ─────────────────────────────────────────────────────

gravitee-health: ## Check Gravitee health
	./scripts/gravitee-manage.sh health staging

gravitee-upgrade: ## Upgrade Gravitee (usage: make gravitee-upgrade VERSION=4.5.0)
	./scripts/gravitee-manage.sh upgrade staging $(VERSION)

gravitee-backup: ## Backup Gravitee data
	./scripts/gravitee-manage.sh backup staging

gravitee-logs: ## Stream Gravitee gateway logs
	./scripts/gravitee-manage.sh logs staging gateway

gravitee-restart: ## Restart all Gravitee components
	./scripts/gravitee-manage.sh restart staging all

gravitee-scale: ## Scale Gravitee gateway (usage: make gravitee-scale REPLICAS=5)
	./scripts/gravitee-manage.sh scale staging $(REPLICAS)

# ─── Secret Management ────────────────────────────────────────────────────────

rotate-secrets-staging: ## Rotate all secrets in staging
	./scripts/rotate-secrets.sh staging all

rotate-jwt-staging: ## Rotate JWT secret in staging
	./scripts/rotate-secrets.sh staging jwt

rotate-db-staging: ## Rotate database password in staging
	./scripts/rotate-secrets.sh staging database

rotate-gravitee-token: ## Rotate Gravitee API token
	./scripts/rotate-secrets.sh staging gravitee
