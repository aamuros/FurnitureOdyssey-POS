import assert from "node:assert/strict";
import test from "node:test";
import { createUserSchema, updateUserSchema } from "@/lib/validation/users";

const baseCreateInput = {
  email: "staff@example.com",
  displayName: "Staff User",
  role: "STAFF",
  permissions: [],
  password: "temporary123",
  confirmPassword: "temporary123"
};

test("createUserSchema requires a temporary password and matching confirmation", () => {
  const valid = createUserSchema.safeParse(baseCreateInput);
  assert.equal(valid.success, true);

  const missingPassword = createUserSchema.safeParse({
    ...baseCreateInput,
    password: "",
    confirmPassword: ""
  });
  assert.equal(missingPassword.success, false);
  assert.match(missingPassword.error.issues[0]?.message ?? "", /at least 8 characters/i);

  const mismatch = createUserSchema.safeParse({
    ...baseCreateInput,
    confirmPassword: "different123"
  });
  assert.equal(mismatch.success, false);
  assert.match(mismatch.error.issues[0]?.message ?? "", /match/i);
});

test("updateUserSchema does not require password fields", () => {
  const parsed = updateUserSchema.safeParse({
    userId: "00000000-0000-0000-0000-000000000001",
    displayName: "Staff User",
    role: "STAFF",
    status: "ACTIVE",
    permissions: []
  });

  assert.equal(parsed.success, true);
});

test("user schemas default Google Calendar linking permission to false", () => {
  const created = createUserSchema.parse(baseCreateInput);
  assert.equal(created.canLinkGoogleCalendar, false);

  const updated = updateUserSchema.parse({
    userId: "00000000-0000-0000-0000-000000000001",
    displayName: "Staff User",
    role: "STAFF",
    status: "ACTIVE",
    permissions: []
  });
  assert.equal(updated.canLinkGoogleCalendar, false);
});

test("user schemas parse Google Calendar linking permission from the checkbox", () => {
  const created = createUserSchema.parse({
    ...baseCreateInput,
    canLinkGoogleCalendar: true
  });
  assert.equal(created.canLinkGoogleCalendar, true);

  const updated = updateUserSchema.parse({
    userId: "00000000-0000-0000-0000-000000000001",
    displayName: "Staff User",
    role: "STAFF",
    status: "ACTIVE",
    permissions: [],
    canLinkGoogleCalendar: true
  });
  assert.equal(updated.canLinkGoogleCalendar, true);
});

test("user schemas accept Catalogue permissions with upload and reset actions", () => {
  const parsed = updateUserSchema.safeParse({
    userId: "00000000-0000-0000-0000-000000000001",
    displayName: "Staff User",
    role: "STAFF",
    status: "ACTIVE",
    permissions: [
      { module: "CATALOGUE", action: "VIEW", allowed: true },
      { module: "CATALOGUE", action: "UPDATE", allowed: true },
      { module: "CATALOGUE", action: "UPLOAD", allowed: true },
      { module: "CATALOGUE", action: "RESET", allowed: true }
    ]
  });

  assert.equal(parsed.success, true);
});
