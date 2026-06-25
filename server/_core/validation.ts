import { TRPCError } from "@trpc/server";

const ALLOWED_URL_SCHEMES = ["http:", "https:"];

// RFC-1918 + loopback CIDR blocks that must not be reachable from user-supplied backend URLs
const PRIVATE_RANGES = [
  /^127\./,                     // 127.0.0.0/8 loopback
  /^10\./,                      // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,// 172.16.0.0/12
  /^192\.168\./,                // 192.168.0.0/16
  /^169\.254\./,                // 169.254.0.0/16 link-local (AWS metadata)
  /^::1$/,                      // IPv6 loopback
  /^fc00:/,                     // IPv6 unique local
  /^fe80:/,                     // IPv6 link-local
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_RANGES.some(re => re.test(hostname));
}

/**
 * Validate a URL supplied by a user as a backend/integration target.
 * Blocks non-HTTP(S) schemes and private/loopback addresses to prevent SSRF.
 * Set env ALLOW_PRIVATE_BACKEND_URLS=true for dev environments with internal targets.
 */
export function validateBackendUrl(url: string, fieldName = "url"): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${fieldName}: must be a valid URL` });
  }

  if (!ALLOWED_URL_SCHEMES.includes(parsed.protocol)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${fieldName}: only http:// and https:// are allowed`,
    });
  }

  if (process.env.ALLOW_PRIVATE_BACKEND_URLS !== "true" && isPrivateHost(parsed.hostname)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${fieldName}: private/loopback addresses are not allowed. Set ALLOW_PRIVATE_BACKEND_URLS=true to override.`,
    });
  }
}

/** Validate a context path: must start with /, lowercase alphanum/hyphens/slashes only */
export function validateContextPath(path: string): void {
  if (!/^\/[a-z0-9\-\/]*$/.test(path)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "contextPath must start with / and contain only lowercase letters, numbers, hyphens, and slashes",
    });
  }
  if (path.includes("..") || path.includes("//")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "contextPath must not contain path traversal sequences" });
  }
}
