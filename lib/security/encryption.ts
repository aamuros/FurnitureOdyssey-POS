import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";
const version = "v1";

function encryptionKey() {
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();

  if (!key) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is required to encrypt Google OAuth tokens.");
  }

  return createHash("sha256").update(key).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    version,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(":");
}

export function decryptSecret(value: string): string {
  const [storedVersion, iv, authTag, encrypted] = value.split(":");

  if (storedVersion !== version || !iv || !authTag || !encrypted) {
    throw new Error("Encrypted secret format is invalid.");
  }

  const decipher = createDecipheriv(algorithm, encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
