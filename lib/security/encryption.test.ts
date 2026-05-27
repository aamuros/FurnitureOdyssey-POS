import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
});

test("encrypts and decrypts secrets without storing plaintext", () => {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "local-test-encryption-key";

  const encrypted = encryptSecret("google-refresh-token");

  assert.notEqual(encrypted, "google-refresh-token");
  assert.equal(encrypted.includes("google-refresh-token"), false);
  assert.equal(decryptSecret(encrypted), "google-refresh-token");
});

test("encrypts the same value differently each time", () => {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "local-test-encryption-key";

  assert.notEqual(encryptSecret("repeat-token"), encryptSecret("repeat-token"));
});

test("throws a clear error when encryption key is missing", () => {
  delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

  assert.throws(
    () => encryptSecret("google-refresh-token"),
    /GOOGLE_TOKEN_ENCRYPTION_KEY is required/
  );
});
