type GoogleCalendarConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing Google Calendar server configuration: ${name}`);
  }

  return value;
}

export function getGoogleCalendarConfig(): GoogleCalendarConfig {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = requiredEnv("GOOGLE_CALENDAR_REDIRECT_URI");

  try {
    new URL(redirectUri);
  } catch {
    throw new Error("GOOGLE_CALENDAR_REDIRECT_URI must be a valid URL.");
  }

  return {
    clientId,
    clientSecret,
    redirectUri
  };
}

export function getGoogleCalendarOwnerEmail(): string | null {
  return process.env.GOOGLE_CALENDAR_OWNER_EMAIL?.trim() || process.env.FIRST_ADMIN_EMAIL?.trim() || null;
}
