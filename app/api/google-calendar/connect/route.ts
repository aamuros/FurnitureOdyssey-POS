import { NextResponse, type NextRequest } from "next/server";
import { getGoogleCalendarConfig } from "@/lib/google-calendar/config";
import { buildGoogleOAuthUrl, createGoogleOAuthState } from "@/lib/google-calendar/oauth";
import { requireActiveUser } from "@/lib/auth/server";
import { canSelfManageGoogleCalendar } from "@/lib/auth/calendar-access";

function usersRedirect(request: NextRequest, status: "error", message: string) {
  const url = new URL("/users", request.url);
  url.searchParams.set("calendar", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const user = await requireActiveUser();

  if (!canSelfManageGoogleCalendar(user)) {
    return usersRedirect(request, "error", "Google Calendar integration is not enabled for your account.");
  }

  try {
    const config = getGoogleCalendarConfig();
    const state = createGoogleOAuthState(user.id);
    const authorizationUrl = buildGoogleOAuthUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    return usersRedirect(
      request,
      "error",
      error instanceof Error ? error.message : "Could not start Google Calendar connection."
    );
  }
}
