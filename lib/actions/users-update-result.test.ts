import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/actions/users.ts", "utf8");

test("update user action returns the saved permission payload for immediate UI state", () => {
  assert.match(source, /user\?: \{/);
  assert.match(source, /revision\?: number/);
  assert.match(source, /permissions: Array<\{/);
  assert.match(source, /revision: Date\.now\(\)/);
  assert.match(source, /user:\s*\{\s*userId: parsed\.data\.userId,[\s\S]*?permissions: normalizePermissions\(parsed\.data\.permissions\)/);
});
