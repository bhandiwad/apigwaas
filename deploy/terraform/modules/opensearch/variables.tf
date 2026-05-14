variable "project_name" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "eks_security_group" { type = string }
variable "instance_type" { type = string }
variable "instance_count" { type = number }
variable "volume_size" { type = number }
