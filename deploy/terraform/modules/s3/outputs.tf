output "platform_bucket_id" {
  value = aws_s3_bucket.platform.id
}

output "platform_bucket_arn" {
  value = aws_s3_bucket.platform.arn
}

output "backups_bucket_id" {
  value = aws_s3_bucket.backups.id
}

output "backups_bucket_arn" {
  value = aws_s3_bucket.backups.arn
}
