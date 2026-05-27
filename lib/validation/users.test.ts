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
