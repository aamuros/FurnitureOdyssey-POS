import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/auth/server";

function usersRedirect(request: NextRequest, status: "success" | "error", message: string) {
  const url = new URL("/users", request.url);
  url.searchParams.set("calendar", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest) {
  const user = await requireActiveUser();

  await prisma.userCalendarConnection.updateMany({
    where: {
      userId: user.id,
      revokedAt: null
    },
    data: {
      revokedAt: new Date(),
      accessToken: null
    }
  });

  return usersRedirect(request, "success", "Google Calendar disconnected.");
}
