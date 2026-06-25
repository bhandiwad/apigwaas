import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { ENV } from "./env";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(): Buffer {
  if (!ENV.encryptionKey) return Buffer.alloc(32, 0); // no-op key when not configured
  return Buffer.from(ENV.encryptionKey, "hex");
}

// Returns "iv:tag:ciphertext" all base64, colon-delimited
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decrypt(ciphertext: string): string {
  // Transparent passthrough for values that were stored before encryption was enabled
  if (!ciphertext.includes(":")) return ciphertext;
  const [ivB64, tagB64, ctB64] = ciphertext.split(":");
  if (!ivB64 || !tagB64 || !ctB64) return ciphertext;
  try {
    const key = getKey();
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return decipher.update(Buffer.from(ctB64, "base64")).toString("utf8") + decipher.final("utf8");
  } catch {
    // If key changed or data corrupt, return as-is rather than crashing
    return ciphertext;
  }
}

// For nullable fields: null stays null
export function encryptNullable(val: string | null | undefined): string | null {
  if (!val) return null;
  return encrypt(val);
}

export function decryptNullable(val: string | null | undefined): string | null {
  if (!val) return null;
  return decrypt(val);
}
