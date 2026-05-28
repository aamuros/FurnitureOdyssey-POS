import assert from "node:assert/strict";
import test from "node:test";
import { canAccessUsersPage, canManageUsers, canSelfManageGoogleCalendar } from "@/lib/auth/calendar-access";

const baseUser = {
  role: "STAFF" as const,
  canLinkGoogleCalendar: false
};

test("admins can access and manage the Users page regardless of calendar flag", () => {
  const user = {
    ...baseUser,
    role: "ADMIN" as const
  };

  assert.equal(canAccessUsersPage(user), true);
  assert.equal(canManageUsers(user), true);
  assert.equal(canSelfManageGoogleCalendar(user), true);
});

test("staff can access Users page only when Google Calendar linking is allowed", () => {
  assert.equal(canAccessUsersPage(baseUser), false);
  assert.equal(canSelfManageGoogleCalendar(baseUser), false);
  assert.equal(canManageUsers(baseUser), false);

  const allowedStaff = {
    ...baseUser,
    canLinkGoogleCalendar: true
  };

  assert.equal(canAccessUsersPage(allowedStaff), true);
  assert.equal(canSelfManageGoogleCalendar(allowedStaff), true);
  assert.equal(canManageUsers(allowedStaff), false);
});
