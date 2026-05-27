import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoogleOAuthUrl,
  createGoogleOAuthState,
  googleCalendarScopes,
  verifyGoogleOAuthState
} from "@/lib/google-calendar/oauth";

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
});

test("builds Google OAuth URL with offline consent and calendar scopes", () => {
  const url = new URL(
    buildGoogleOAuthUrl({
      clientId: "client-id",
      redirectUri: "https://app.example.com/api/google-calendar/callback",
      state: "signed-state"
    })
  );

  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("redirect_uri"), "https://app.example.com/api/google-calendar/callback");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "signed-state");
  assert.deepEqual(url.searchParams.get("scope")?.split(" "), googleCalendarScopes);
});

test("verifies signed OAuth state for the current user", () => {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "local-test-state-key";

  const state = createGoogleOAuthState("user-1", new Date("2026-05-27T00:00:00.000Z"));

  assert.deepEqual(
    verifyGoogleOAuthState(state, "user-1", new Date("2026-05-27T00:05:00.000Z")),
    { userId: "user-1" }
  );
});

test("rejects tampered OAuth state", () => {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "local-test-state-key";

  const state = createGoogleOAuthState("user-1", new Date("2026-05-27T00:00:00.000Z"));
  const tampered = state.replace(/.$/, state.endsWith("a") ? "b" : "a");

  assert.throws(
    () => verifyGoogleOAuthState(tampered, "user-1", new Date("2026-05-27T00:05:00.000Z")),
    /Google OAuth state is invalid/
  );
});

test("rejects OAuth state for a different user", () => {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "local-test-state-key";

  const state = createGoogleOAuthState("user-1", new Date("2026-05-27T00:00:00.000Z"));

  assert.throws(
    () => verifyGoogleOAuthState(state, "user-2", new Date("2026-05-27T00:05:00.000Z")),
    /Google OAuth state does not match the current user/
  );
});
