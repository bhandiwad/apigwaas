# Deployment Guide

This guide covers all deployment methods for the CloudInfinit API Gateway platform, from local Docker development to production Kubernetes clusters with automated CI/CD.

---

## Table of Contents

1. [Quick Start (Docker Compose)](#quick-start-docker-compose)
2. [Production Deployment (Kubernetes)](#production-deployment-kubernetes)
3. [Infrastructure Provisioning (Terraform)](#infrastructure-provisioning-terraform)
4. [CI/CD Pipeline (GitHub Actions)](#cicd-pipeline-github-actions)
5. [Gravitee APIM Management](#gravitee-apim-management)
6. [Operational Runbook](#operational-runbook)

---

## Quick Start (Docker Compose)

The fastest way to get the full platform running locally with Gravitee APIM, databases, and monitoring.

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Docker Engine | 24+ | Container runtime |
| Docker Compose | v2.20+ | Multi-container orchestration |
| RAM | 8GB minimum | 16GB recommended for full stack |
| Disk | 20GB | For images and volumes |

### One-Command Start

```bash
# Development mode with hot-reload
make dev

# Production-like mode
make prod

# Full stack with Prometheus + Grafana monitoring
make full
```

Or use the script directly:

```bash
./scripts/docker-start.sh dev      # Development
./scripts/docker-start.sh prod     # Production
./scripts/docker-start.sh full     # Everything
./scripts/docker-start.sh stop     # Stop all
./scripts/docker-start.sh clean    # Remove all data
```

### Service Endpoints (Local)

| Service | URL | Credentials |
|---------|-----|-------------|
| Platform UI | http://localhost:3000 | OAuth login |
| Gravitee Gateway | http://localhost:8082 | — |
| Gravitee Management API | http://localhost:8083 | admin/admin |
| Gravitee Console UI | http://localhost:8084 | admin/admin |
| MySQL | localhost:3306 | root/cloudinfinit |
| MongoDB | localhost:27017 | gravitee/gravitee |
| Redis | localhost:6379 | — |
| Elasticsearch | localhost:9200 | — |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3001 | admin/admin |
| AlertManager | http://localhost:9093 | — |

### Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Core production stack (platform + Gravitee + DBs + Nginx) |
| `docker-compose.dev.yml` | Development overrides (hot-reload, debug ports, source mounts) |
| `docker-compose.monitoring.yml` | Prometheus, Grafana, AlertManager |

### Configuration

```bash
cp deploy/docker/.env.template deploy/docker/.env
# Edit .env with your settings
```

### Architecture (Docker Compose)

```
┌─────────────────────────────────────────────────────────────┐
│                     Nginx Reverse Proxy                       │
│                     (Port 80/443)                             │
└─────────┬──────────────────────────────────┬────────────────┘
          │                                  │
┌─────────▼──────────┐          ┌───────────▼────────────────┐
│  CloudInfinit App  │          │     Gravitee Gateway       │
│  (Node.js :3000)   │          │     (Java :8082)           │
└─────────┬──────────┘          └───────────┬────────────────┘
          │                                  │
┌─────────▼──────────┐          ┌───────────▼────────────────┐
│  MySQL 8.0         │          │  Gravitee Management API   │
│  (Platform DB)     │          │  (Java :8083)              │
└────────────────────┘          └───────────┬────────────────┘
                                            │
                    ┌───────────────────────┬┴──────────────────┐
                    │                       │                    │
          ┌────────▼───────┐    ┌──────────▼─────┐   ┌────────▼───────┐
          │  MongoDB 7.0   │    │ Elasticsearch  │   │  Redis 7.2     │
          │  (Gravitee DB) │    │ (Analytics)    │   │  (Rate Limit)  │
          └────────────────┘    └────────────────┘   └────────────────┘
```

---

## Production Deployment (Kubernetes)

Production deployments use Helm charts on AWS EKS (or any Kubernetes 1.28+ cluster).

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Kubernetes | 1.28+ | EKS, GKE, or AKS |
| Helm | 3.14+ | Package manager |
| kubectl | Configured | Cluster access |
| GHCR | Authenticated | Container registry |

### Helm Charts

Two Helm charts are provided:

| Chart | Path | Purpose |
|-------|------|---------|
| `cloudinfinit-apigw` | `deploy/helm/cloudinfinit-apigw/` | Platform application |
| `gravitee-apim` | `deploy/helm/gravitee-apim/` | Gravitee APIM stack |

### Deploy Commands

```bash
# Full deployment (build + push + deploy platform + Gravitee)
make deploy-staging

# Deploy only the platform
make deploy-platform-staging

# Deploy only Gravitee APIM
make deploy-gravitee-staging

# Production deployment
make deploy-prod
```

### Helm Values Override

```bash
# Staging
helm upgrade --install cloudinfinit-apigw deploy/helm/cloudinfinit-apigw \
  --namespace cloudinfinit-staging --create-namespace \
  --set replicaCount=2 \
  --set autoscaling.enabled=true \
  --set env.GRAVITEE_API_URL=https://gravitee-api.staging.cloudinfinit.io

# Production
helm upgrade --install cloudinfinit-apigw deploy/helm/cloudinfinit-apigw \
  --namespace cloudinfinit-production --create-namespace \
  --set replicaCount=3 \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=3 \
  --set autoscaling.maxReplicas=10 \
  --set resources.requests.memory=512Mi \
  --set resources.requests.cpu=500m
```

### Production Architecture (Kubernetes)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS EKS Cluster                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐    ┌────────────────────────────────┐   │
│  │ Namespace:              │    │ Namespace:                      │   │
│  │ cloudinfinit-production │    │ gravitee-production             │   │
│  ├────────────────────────┤    ├────────────────────────────────┤   │
│  │ Platform App (3-10x)    │    │ Gateway (5-20x)                 │   │
│  │ + HPA (CPU/Memory)     │    │ Management API (3x)             │   │
│  │ + PDB (minAvail=2)     │    │ Portal UI (2x)                  │   │
│  │ + NetworkPolicy        │    │ + HPA + PDB                     │   │
│  └────────────────────────┘    └────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  Ingress (Nginx) → TLS (cert-manager) → AWS ALB                     │
└─────────────────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
    │ RDS     │         │ DocDB   │         │ ElastiC │
    │ MySQL   │         │ MongoDB │         │ Redis   │
    │ Multi-AZ│         │ 3-node  │         │ Cluster │
    └─────────┘         └─────────┘         └─────────┘
```

### Scaling

```bash
# Scale platform
make scale-staging REPLICAS=5

# Scale Gravitee gateway
make gravitee-scale REPLICAS=8
```

### Rollback

```bash
# Rollback to previous release
make rollback-staging

# Rollback to specific revision
./scripts/deploy.sh staging rollback 3
```

---

## Infrastructure Provisioning (Terraform)

Terraform modules provision the complete AWS infrastructure with production-grade security and high availability.

### What Gets Created

| Resource | Module | Purpose | HA |
|----------|--------|---------|-----|
| VPC + Subnets | `modules/vpc` | Network isolation, 3 AZs | Multi-AZ |
| EKS Cluster | `modules/eks` | Kubernetes control plane + managed node groups | Multi-AZ |
| RDS MySQL 8.0 | `modules/rds` | Platform database | Multi-AZ |
| DocumentDB | `modules/documentdb` | Gravitee MongoDB | 3-node cluster |
| ElastiCache Redis | `modules/elasticache` | Rate limiting, session cache | 2-node cluster |
| OpenSearch | `modules/opensearch` | Gravitee analytics, logging | 3-node cluster |
| S3 Buckets | `modules/s3` | Audit logs, backups, assets | Cross-region |

### Provisioning Steps

```bash
# 1. Create state bucket (one-time)
aws s3 mb s3://cloudinfinit-terraform-state --region ap-south-1
aws s3api put-bucket-versioning \
  --bucket cloudinfinit-terraform-state \
  --versioning-configuration Status=Enabled

# 2. Initialize Terraform
./scripts/infra-provision.sh staging init

# 3. Plan (review changes)
make infra-plan-staging

# 4. Apply (provision resources)
make infra-apply-staging

# 5. Verify outputs
./scripts/infra-provision.sh staging output
```

### Environment Configuration

Edit `deploy/terraform/environments/staging.tfvars`:

```hcl
project_name = "cloudinfinit-apigw"
environment  = "staging"
aws_region   = "ap-south-1"

# EKS
eks_node_instance_types = ["t3.large"]
eks_node_desired_size   = 3
eks_node_max_size       = 6

# RDS
rds_instance_class      = "db.r6g.large"
rds_multi_az            = true
rds_allocated_storage   = 100

# DocumentDB
docdb_instance_class = "db.r6g.large"
docdb_instance_count = 3

# ElastiCache
redis_node_type     = "cache.r6g.large"
redis_num_replicas  = 1

# OpenSearch
opensearch_instance_type  = "r6g.large.search"
opensearch_instance_count = 3
```

### Destroying Infrastructure

```bash
# Staging (requires confirmation)
make infra-destroy-staging

# Production (requires typing environment name)
./scripts/infra-provision.sh production destroy
```

---

## CI/CD Pipeline (GitHub Actions)

Three workflows automate the full lifecycle from code push to production deployment.

### Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| CI | `.github/workflows/ci.yml` | Push/PR to main | Lint, test, build, security scan |
| CD | `.github/workflows/cd.yml` | Push to main / tags | Deploy staging (main) or production (tags) |
| Infrastructure | `.github/workflows/infrastructure.yml` | Changes to `deploy/terraform/` | Terraform plan/apply |

### CI Pipeline Flow

```
Push/PR → Install Deps → Type Check → Unit Tests → Build Docker Image
                                                          │
                                              Push to GHCR → Trivy Security Scan
```

### CD Pipeline Flow

```
Main branch push → Deploy to Staging → Smoke Tests → ✓
                                                      
v* tag push → Deploy to Production → Health Check → ✓
```

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | AWS authentication for EKS/ECR |
| `AWS_SECRET_ACCESS_KEY` | AWS authentication |
| `STAGING_DATABASE_URL` | Staging MySQL connection string |
| `STAGING_GRAVITEE_API_URL` | Staging Gravitee Management API URL |
| `STAGING_GRAVITEE_API_TOKEN` | Staging Gravitee PAT |
| `STAGING_GRAVITEE_ORG_ID` | Staging organization ID |
| `STAGING_GRAVITEE_ENV_ID` | Staging environment ID |
| `PROD_DATABASE_URL` | Production MySQL connection string |
| `PROD_GRAVITEE_API_URL` | Production Gravitee Management API URL |
| `PROD_GRAVITEE_API_TOKEN` | Production Gravitee PAT |
| `PROD_GRAVITEE_ORG_ID` | Production organization ID |
| `PROD_GRAVITEE_ENV_ID` | Production environment ID |

### Release Process

```bash
# 1. Develop on feature branch
git checkout -b feature/new-policy

# 2. Push → CI runs tests automatically
git push origin feature/new-policy

# 3. Merge to main → auto-deploys to staging
gh pr create && gh pr merge

# 4. Verify staging
make gravitee-health

# 5. Tag for production release
git tag v1.2.0 && git push --tags
# → Triggers production deployment automatically
```

---

## Gravitee APIM Management

### Lifecycle Operations

```bash
# Health check all components
make gravitee-health

# Upgrade Gravitee to new version
make gravitee-upgrade VERSION=4.5.0

# Backup MongoDB data to S3
make gravitee-backup

# Restart all components
make gravitee-restart

# Stream gateway logs
make gravitee-logs

# Scale gateway replicas
make gravitee-scale REPLICAS=8
```

### Generating a Personal Access Token

1. Log in to the Gravitee Console UI
2. Navigate to User Settings → Tokens
3. Click "Generate Token"
4. Set an appropriate expiration (or no expiration for service accounts)
5. Copy the token and configure as `GRAVITEE_API_TOKEN`

### Required Gravitee Permissions

| Scope | Permission | Purpose |
|-------|-----------|---------|
| Organization | READ | List organization details |
| Environment | READ, UPDATE | Manage environment configuration |
| API | CRUD | Full API lifecycle management |
| Application | CRUD | DCR and consumer app management |
| Subscription | CRUD | Subscription processing |
| Instance | READ | Gateway node monitoring |
| Analytics | READ | Platform and per-API metrics |

### Backup & Restore

```bash
# Create backup (uploads to S3)
./scripts/gravitee-manage.sh backup production

# List backups
aws s3 ls s3://cloudinfinit-apigw-production-backups/gravitee/

# Restore from backup
./scripts/gravitee-manage.sh restore production <backup-filename>
```

---

## Operational Runbook

### Common Operations

| Task | Command |
|------|---------|
| View all service status | `make status` |
| View deployment history | `helm history cloudinfinit-apigw -n cloudinfinit-staging` |
| Force restart platform | `kubectl rollout restart deployment/cloudinfinit-apigw -n cloudinfinit-staging` |
| Check resource usage | `kubectl top pods -n cloudinfinit-staging` |
| View platform logs | `kubectl logs -f -l app=cloudinfinit-apigw -n cloudinfinit-staging` |
| Database migration | `kubectl exec -it deploy/cloudinfinit-apigw -- pnpm db:push` |
| Scale platform | `make scale-staging REPLICAS=5` |

### Troubleshooting

**Platform pods in CrashLoopBackOff:**
```bash
kubectl describe pod -l app=cloudinfinit-apigw -n cloudinfinit-staging
kubectl logs -l app=cloudinfinit-apigw -n cloudinfinit-staging --previous
```

**Gravitee gateway not responding:**
```bash
./scripts/gravitee-manage.sh health staging
./scripts/gravitee-manage.sh restart staging gateway
```

**Database connection issues:**
```bash
aws rds describe-db-instances --db-instance-identifier cloudinfinit-apigw-staging
kubectl exec -it deploy/cloudinfinit-apigw -n cloudinfinit-staging -- nc -zv <rds-endpoint> 3306
```

### Disaster Recovery

| Scenario | Recovery Steps |
|----------|---------------|
| Platform failure | Rollback Helm release → `make rollback-staging` |
| Gravitee failure | Restore from backup → `./scripts/gravitee-manage.sh restore staging <backup>` |
| Infrastructure failure | Re-apply Terraform → `make infra-apply-staging` |
| Complete rebuild | Terraform apply → Helm deploy → Restore backups |

### Security Checklist

- [ ] All secrets stored in AWS Secrets Manager (not in code or ConfigMaps)
- [ ] Network policies restricting pod-to-pod traffic
- [ ] TLS everywhere (cert-manager + Let's Encrypt)
- [ ] Container images scanned with Trivy in CI
- [ ] RBAC configured for kubectl access (no cluster-admin for devs)
- [ ] Audit logging enabled on EKS control plane
- [ ] Encryption at rest for RDS, DocumentDB, S3, OpenSearch
- [ ] VPC endpoints for AWS services (no public internet for data plane)
- [ ] Pod Security Standards enforced (restricted profile)
- [ ] Gravitee API tokens rotated every 90 days
