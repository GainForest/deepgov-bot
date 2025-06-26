import { createHmac, randomBytes } from "crypto";
import "dotenv/config";

const SECRET_KEY = process.env.HMAC_SECRET_KEY;

if (!SECRET_KEY) {
  throw new Error("Missing HMAC_SECRET_KEY in environment variables");
}

/**
 * Generates a cryptographically secure random salt.
 * @param length Length in bytes (default: 16)
 * @returns Hex-encoded salt string
 */
function generateSalt(length: number = 16): string {
  return randomBytes(length).toString("hex");
}

/**
 * Creates an HMAC-SHA256 hash of the input using a secret key and salt.
 * @param data The data to hash
 * @param salt The salt to prepend
 * @returns Hex-encoded hash
 */
function hashWithSalt(data: string, salt: string): string {
  const hmac = createHmac("sha256", SECRET_KEY as string);
  hmac.update(salt + ":" + data); // Use a delimiter to avoid collisions
  return hmac.digest("hex");
}

/**
 * Hashes data with a newly generated salt and returns both.
 * @param data The input to hash
 * @param saltLength Optional salt length
 * @returns Object with hash and salt
 */
export function hash(
  data: string,
  saltLength: number = 16
): { hash: string; salt: string } {
  const salt = generateSalt(saltLength);
  const hash = hashWithSalt(data, salt);
  return { hash, salt };
}
