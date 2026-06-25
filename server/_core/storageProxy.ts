import type { Express } from "express";

// Manus storage proxy removed. S3 uploads go directly to the client via presigned URLs.
export function registerStorageProxy(_app: Express) {}
