import { createHmac } from "crypto";
import "dotenv/config";

const SECRET_KEY = process.env.HMAC_SECRET_KEY;
const HASH_SALT = process.env.HASH_SALT;

if (!SECRET_KEY || !HASH_SALT) {
  throw new Error(
    "Missing HMAC_SECRET_KEY or HASH_SALT in environment variables."
  );
}

/**
 * Deterministically hash a user ID with a fixed salt and secret key.
 * @param userId The user ID to hash (as a string)
 * @returns Stable, hex-encoded hash
 */
export function hash(userId: string): string {
  const hmac = createHmac("sha256", SECRET_KEY!);
  hmac.update(HASH_SALT + ":" + userId); // Delimiter avoids collisions
  return hmac.digest("hex");
}
