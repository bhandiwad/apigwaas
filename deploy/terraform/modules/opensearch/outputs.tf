output "endpoint" {
  value = aws_opensearch_domain.main.endpoint
}

output "dashboard_endpoint" {
  value = aws_opensearch_domain.main.dashboard_endpoint
}

output "secret_arn" {
  value = aws_secretsmanager_secret.opensearch.arn
}
