# ============================================================================
# Production Environment Configuration
# ============================================================================

aws_region         = "ap-south-1"
project_name       = "cloudinfinit-apigw"
environment        = "production"
vpc_cidr           = "10.0.0.0/16"
kubernetes_version = "1.29"

rds_instance_class    = "db.r5.large"
rds_allocated_storage = 100

documentdb_instance_class = "db.r5.large"

redis_node_type = "cache.r5.large"

opensearch_instance_type = "r5.large.search"
opensearch_volume_size   = 200

node_groups = {
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
    desired_size   = 5
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
    min_size       = 3
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
