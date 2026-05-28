import type { UserProfile } from "@prisma/client";
import { isAdmin } from "@/lib/auth/permissions";

type CalendarAccessUser = Pick<UserProfile, "role" | "canLinkGoogleCalendar">;

export function canManageUsers(user: CalendarAccessUser) {
  return isAdmin(user);
}

export function canSelfManageGoogleCalendar(user: CalendarAccessUser) {
  return isAdmin(user) || user.canLinkGoogleCalendar;
}

export function canAccessUsersPage(user: CalendarAccessUser) {
  return canManageUsers(user) || canSelfManageGoogleCalendar(user);
}
