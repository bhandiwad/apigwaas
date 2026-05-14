# ============================================================================
# DocumentDB Module - Gravitee MongoDB Compatible
# ============================================================================

resource "aws_docdb_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-docdb-subnet"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.project_name}-${var.environment}-docdb-subnet-group"
  }
}

resource "aws_security_group" "docdb" {
  name_prefix = "${var.project_name}-${var.environment}-docdb-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [var.eks_security_group]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-docdb-sg"
  }
}

resource "aws_docdb_cluster" "main" {
  cluster_identifier = "${var.project_name}-${var.environment}-gravitee"

  master_username = "gravitee"
  master_password = random_password.docdb.result

  db_subnet_group_name   = aws_docdb_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.docdb.id]

  storage_encrypted          = true
  backup_retention_period    = 7
  preferred_backup_window    = "03:00-04:00"
  deletion_protection        = true
  skip_final_snapshot        = false
  final_snapshot_identifier  = "${var.project_name}-${var.environment}-docdb-final"

  engine_version = "5.0.0"
}

resource "aws_docdb_cluster_instance" "main" {
  count = var.instance_count

  identifier         = "${var.project_name}-${var.environment}-gravitee-${count.index}"
  cluster_identifier = aws_docdb_cluster.main.id
  instance_class     = var.instance_class
}

resource "random_password" "docdb" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "docdb" {
  name = "${var.project_name}-${var.environment}-docdb-credentials"
}

resource "aws_secretsmanager_secret_version" "docdb" {
  secret_id = aws_secretsmanager_secret.docdb.id
  secret_string = jsonencode({
    username = "gravitee"
    password = random_password.docdb.result
    host     = aws_docdb_cluster.main.endpoint
    port     = aws_docdb_cluster.main.port
  })
}
