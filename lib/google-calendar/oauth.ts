import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const googleCalendarScopes = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email"
];

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const userInfoEndpoint = "https://www.googleapis.com/oauth2/v3/userinfo";
const tokenInfoEndpoint = "https://oauth2.googleapis.com/tokeninfo";
const stateMaxAgeMs = 10 * 60 * 1000;

type OAuthStatePayload = {
  userId: string;
  nonce: string;
  issuedAt: number;
};

export type GoogleOAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

function signingKey() {
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();

  if (!key) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is required to sign Google OAuth state.");
  }

  return key;
}

function sign(value: string) {
  return createHmac("sha256", signingKey()).update(value).digest("base64url");
}

function encodePayload(payload: OAuthStatePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string): OAuthStatePayload {
  const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<OAuthStatePayload>;

  if (
    typeof parsed.userId !== "string" ||
    typeof parsed.nonce !== "string" ||
    typeof parsed.issuedAt !== "number"
  ) {
    throw new Error("Google OAuth state is invalid.");
  }

  return parsed as OAuthStatePayload;
}

export function createGoogleOAuthState(userId: string, now = new Date()) {
  const payload = encodePayload({
    userId,
    nonce: randomBytes(16).toString("base64url"),
    issuedAt: now.getTime()
  });

  return `${payload}.${sign(payload)}`;
}

export function verifyGoogleOAuthState(state: string, currentUserId: string, now = new Date()) {
  const [payload, signature] = state.split(".");

  if (!payload || !signature) {
    throw new Error("Google OAuth state is invalid.");
  }

  const expectedSignature = sign(payload);
  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Google OAuth state is invalid.");
  }

  const decoded = decodePayload(payload);

  if (decoded.userId !== currentUserId) {
    throw new Error("Google OAuth state does not match the current user.");
  }

  if (now.getTime() - decoded.issuedAt > stateMaxAgeMs) {
    throw new Error("Google OAuth state has expired.");
  }

  return {
    userId: decoded.userId
  };
}

export function buildGoogleOAuthUrl({
  clientId,
  redirectUri,
  state
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(authorizationEndpoint);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", googleCalendarScopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleOAuthCode({
  code,
  clientId,
  clientSecret,
  redirectUri
}: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new Error("Google OAuth token exchange failed.");
  }

  return (await response.json()) as GoogleOAuthTokenResponse;
}

export async function fetchGoogleAccountEmail(accessToken: string) {
  const userInfoResponse = await fetch(userInfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (userInfoResponse.ok) {
    const data = (await userInfoResponse.json()) as { email?: unknown };

    if (typeof data.email === "string" && data.email.trim()) {
      return data.email.trim();
    }
  }

  const tokenInfoUrl = new URL(tokenInfoEndpoint);
  tokenInfoUrl.searchParams.set("access_token", accessToken);
  const tokenInfoResponse = await fetch(tokenInfoUrl, {
    cache: "no-store"
  });

  if (tokenInfoResponse.ok) {
    const data = (await tokenInfoResponse.json()) as { email?: unknown };

    if (typeof data.email === "string" && data.email.trim()) {
      return data.email.trim();
    }
  }

  throw new Error("Could not read Google account email for the connected calendar.");
}
