# ============================================================================
# Staging Environment Configuration
# ============================================================================

aws_region         = "ap-south-1"
project_name       = "cloudinfinit-apigw"
environment        = "staging"
vpc_cidr           = "10.1.0.0/16"
kubernetes_version = "1.29"

rds_instance_class    = "db.t3.medium"
rds_allocated_storage = 50

documentdb_instance_class = "db.t3.medium"

redis_node_type = "cache.t3.medium"

opensearch_instance_type = "t3.medium.search"
opensearch_volume_size   = 50

node_groups = {
  platform = {
    instance_types = ["t3.medium"]
    min_size       = 1
    max_size       = 3
    desired_size   = 2
    disk_size      = 30
    labels         = { workload = "platform" }
    taints         = []
  }
  gateway = {
    instance_types = ["t3.large"]
    min_size       = 1
    max_size       = 5
    desired_size   = 2
    disk_size      = 30
    labels         = { workload = "gateway" }
    taints         = []
  }
  data = {
    instance_types = ["t3.large"]
    min_size       = 1
    max_size       = 3
    desired_size   = 2
    disk_size      = 50
    labels         = { workload = "data" }
    taints         = []
  }
}
