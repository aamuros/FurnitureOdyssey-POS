import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/auth/server";
import { canSelfManageGoogleCalendar } from "@/lib/auth/calendar-access";
import { getGoogleCalendarConfig } from "@/lib/google-calendar/config";
import {
  exchangeGoogleOAuthCode,
  fetchGoogleAccountEmail,
  googleCalendarScopes,
  verifyGoogleOAuthState
} from "@/lib/google-calendar/oauth";
import { encryptSecret } from "@/lib/security/encryption";

function usersRedirect(request: NextRequest, status: "success" | "error", message: string) {
  const url = new URL("/users", request.url);
  url.searchParams.set("calendar", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

function scopesFromToken(scope: string | undefined) {
  const scopes = scope
    ?.split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return scopes?.length ? scopes : googleCalendarScopes;
}

function tokenExpiry(expiresIn: number | undefined) {
  return typeof expiresIn === "number" && Number.isFinite(expiresIn)
    ? new Date(Date.now() + expiresIn * 1000)
    : null;
}

export async function GET(request: NextRequest) {
  const user = await requireActiveUser();
  const requestUrl = new URL(request.url);
  const error = requestUrl.searchParams.get("error");

  if (!canSelfManageGoogleCalendar(user)) {
    return usersRedirect(request, "error", "Google Calendar integration is not enabled for your account.");
  }

  if (error) {
    return usersRedirect(request, "error", "Google Calendar connection was cancelled or denied.");
  }

  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");

  if (!code || !state) {
    return usersRedirect(request, "error", "Google Calendar callback is missing required data.");
  }

  try {
    verifyGoogleOAuthState(state, user.id);

    const config = getGoogleCalendarConfig();
    const tokens = await exchangeGoogleOAuthCode({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri
    });

    if (!tokens.access_token) {
      throw new Error("Google did not return an access token.");
    }

    const googleAccountEmail = await fetchGoogleAccountEmail(tokens.access_token);
    const existingConnection = await prisma.userCalendarConnection.findUnique({
      where: {
        userId: user.id
      },
      select: {
        refreshToken: true
      }
    });
    const refreshToken = tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : existingConnection?.refreshToken;

    if (!refreshToken) {
      throw new Error("Google did not return a refresh token. Please reconnect and approve offline access.");
    }

    await prisma.userCalendarConnection.upsert({
      where: {
        userId: user.id
      },
      update: {
        provider: "google",
        googleAccountEmail,
        calendarId: "primary",
        accessToken: encryptSecret(tokens.access_token),
        refreshToken,
        tokenExpiry: tokenExpiry(tokens.expires_in),
        scopes: scopesFromToken(tokens.scope),
        revokedAt: null
      },
      create: {
        userId: user.id,
        provider: "google",
        googleAccountEmail,
        calendarId: "primary",
        accessToken: encryptSecret(tokens.access_token),
        refreshToken,
        tokenExpiry: tokenExpiry(tokens.expires_in),
        scopes: scopesFromToken(tokens.scope)
      }
    });

    return usersRedirect(request, "success", "Google Calendar connected.");
  } catch (callbackError) {
    return usersRedirect(
      request,
      "error",
      callbackError instanceof Error ? callbackError.message : "Could not connect Google Calendar."
    );
  }
}
