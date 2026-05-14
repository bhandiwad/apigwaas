# ============================================================================
# CloudInfinit API Gateway - Terraform Variables
# ============================================================================

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "cloudinfinit-apigw"
}

variable "environment" {
  description = "Deployment environment (staging, production)"
  type        = string
  default     = "production"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.29"
}

variable "node_groups" {
  description = "EKS managed node group configurations"
  type = map(object({
    instance_types = list(string)
    min_size       = number
    max_size       = number
    desired_size   = number
    disk_size      = number
    labels         = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
  }))
  default = {
    platform = {
      instance_types = ["t3.large"]
      min_size       = 2
      max_size       = 6
      desired_size   = 3
      disk_size      = 50
      labels         = { workload = "platform" }
      taints         = []
    }
    gateway = {
      instance_types = ["c5.xlarge"]
      min_size       = 3
      max_size       = 20
      desired_size   = 3
      disk_size      = 50
      labels         = { workload = "gateway" }
      taints = [{
        key    = "dedicated"
        value  = "gateway"
        effect = "NoSchedule"
      }]
    }
    data = {
      instance_types = ["r5.xlarge"]
      min_size       = 2
      max_size       = 6
      desired_size   = 3
      disk_size      = 100
      labels         = { workload = "data" }
      taints = [{
        key    = "dedicated"
        value  = "data"
        effect = "NoSchedule"
      }]
    }
  }
}

variable "rds_instance_class" {
  description = "RDS instance class for MySQL"
  type        = string
  default     = "db.r5.large"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "documentdb_instance_class" {
  description = "DocumentDB instance class"
  type        = string
  default     = "db.r5.large"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r5.large"
}

variable "opensearch_instance_type" {
  description = "OpenSearch instance type"
  type        = string
  default     = "r5.large.search"
}

variable "opensearch_volume_size" {
  description = "OpenSearch EBS volume size in GB"
  type        = number
  default     = 200
}
