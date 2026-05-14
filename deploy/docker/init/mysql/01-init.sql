-- ============================================================================
-- CloudInfinit API Gateway - MySQL Initialization
-- Creates database and grants permissions
-- ============================================================================

CREATE DATABASE IF NOT EXISTS cloudinfinit_apigw
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON cloudinfinit_apigw.* TO 'cloudinfinit'@'%';
FLUSH PRIVILEGES;
