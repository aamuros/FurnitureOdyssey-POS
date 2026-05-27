import assert from "node:assert/strict";
import test from "node:test";
import { getGoogleCalendarConfig } from "@/lib/google-calendar/config";

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
});

test("reads validated Google Calendar server config", () => {
  process.env.GOOGLE_CLIENT_ID = "google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
  process.env.GOOGLE_CALENDAR_REDIRECT_URI = "https://app.example.com/api/google-calendar/callback";

  assert.deepEqual(getGoogleCalendarConfig(), {
    clientId: "google-client-id",
    clientSecret: "google-client-secret",
    redirectUri: "https://app.example.com/api/google-calendar/callback"
  });
});

test("rejects missing Google Calendar server config", () => {
  delete process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
  process.env.GOOGLE_CALENDAR_REDIRECT_URI = "https://app.example.com/api/google-calendar/callback";

  assert.throws(
    () => getGoogleCalendarConfig(),
    /Missing Google Calendar server configuration: GOOGLE_CLIENT_ID/
  );
});

test("rejects invalid Google Calendar redirect URI", () => {
  process.env.GOOGLE_CLIENT_ID = "google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
  process.env.GOOGLE_CALENDAR_REDIRECT_URI = "not a url";

  assert.throws(
    () => getGoogleCalendarConfig(),
    /GOOGLE_CALENDAR_REDIRECT_URI must be a valid URL/
  );
});
