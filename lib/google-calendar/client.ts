import { prisma } from "@/lib/prisma";
import { getGoogleCalendarConfig } from "@/lib/google-calendar/config";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";

const tokenEndpoint = "https://oauth2.googleapis.com/token";
const calendarApiBaseUrl = "https://www.googleapis.com/calendar/v3";
const tokenRefreshSkewMs = 60 * 1000;

export type GoogleCalendarClientResult =
  | {
      ok: true;
      userId: string;
      calendarId: string;
      accessToken: string;
    }
  | {
      ok: false;
      code: "NOT_CONNECTED" | "TOKEN_REFRESH_FAILED";
      message: string;
    };

type GoogleRefreshTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

function isTokenExpired(tokenExpiry: Date | null) {
  return !tokenExpiry || tokenExpiry.getTime() <= Date.now() + tokenRefreshSkewMs;
}

function tokenExpiryDate(expiresIn: number | undefined) {
  return typeof expiresIn === "number" && Number.isFinite(expiresIn)
    ? new Date(Date.now() + expiresIn * 1000)
    : null;
}

export function googleCalendarEventsUrl(calendarId: string, eventId?: string) {
  const encodedCalendarId = encodeURIComponent(calendarId);
  const baseUrl = `${calendarApiBaseUrl}/calendars/${encodedCalendarId}/events`;
  return eventId ? `${baseUrl}/${encodeURIComponent(eventId)}` : baseUrl;
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const config = getGoogleCalendarConfig();
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error("Google access token refresh failed.");
  }

  const tokens = (await response.json()) as GoogleRefreshTokenResponse;

  if (!tokens.access_token) {
    throw new Error("Google did not return a refreshed access token.");
  }

  return tokens;
}

export async function getGoogleCalendarClientForUser(userId: string): Promise<GoogleCalendarClientResult> {
  const connection = await prisma.userCalendarConnection.findFirst({
    where: {
      userId,
      provider: "google",
      revokedAt: null
    },
    select: {
      id: true,
      calendarId: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiry: true,
      scopes: true
    }
  });

  if (!connection) {
    return {
      ok: false,
      code: "NOT_CONNECTED",
      message: "Assigned user has no active Google Calendar connection."
    };
  }

  try {
    if (connection.accessToken && !isTokenExpired(connection.tokenExpiry)) {
      return {
        ok: true,
        userId,
        calendarId: connection.calendarId,
        accessToken: decryptSecret(connection.accessToken)
      };
    }

    const tokens = await refreshGoogleAccessToken(decryptSecret(connection.refreshToken));
    const accessToken = tokens.access_token;

    if (!accessToken) {
      throw new Error("Google did not return a refreshed access token.");
    }

    await prisma.userCalendarConnection.update({
      where: {
        id: connection.id
      },
      data: {
        accessToken: encryptSecret(accessToken),
        tokenExpiry: tokenExpiryDate(tokens.expires_in),
        scopes: tokens.scope
          ? tokens.scope.split(/\s+/).map((scope) => scope.trim()).filter(Boolean)
          : connection.scopes
      }
    });

    return {
      ok: true,
      userId,
      calendarId: connection.calendarId,
      accessToken
    };
  } catch (error) {
    return {
      ok: false,
      code: "TOKEN_REFRESH_FAILED",
      message: error instanceof Error ? error.message : "Could not refresh Google Calendar access token."
    };
  }
}
