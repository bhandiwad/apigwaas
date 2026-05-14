output "endpoint" {
  value = aws_docdb_cluster.main.endpoint
}

output "reader_endpoint" {
  value = aws_docdb_cluster.main.reader_endpoint
}

output "secret_arn" {
  value = aws_secretsmanager_secret.docdb.arn
}
