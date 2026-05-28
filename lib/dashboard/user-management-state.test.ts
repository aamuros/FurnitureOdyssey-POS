import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("components/dashboard/user-management.tsx", "utf8");

test("user edit permissions are protected from stale refreshed props after save", () => {
  assert.match(source, /const \[userOverrides, setUserOverrides\] = useState/);
  assert.match(source, /users\.map\(\(user\) =>[\s\S]*?userOverrides\[user\.id\]/);
  assert.match(source, /setUserOverrides\(\(current\) => \(\{/);
});

test("successful user update keeps the edit form open for refreshed checkbox state", () => {
  const updateEffectStart = source.indexOf("if (updateState.message)");
  const deleteEffectStart = source.indexOf("if (deleteState.message)");
  const updateEffect = source.slice(updateEffectStart, deleteEffectStart);

  assert.notEqual(updateEffectStart, -1);
  assert.notEqual(deleteEffectStart, -1);
  assert.doesNotMatch(
    updateEffect,
    /setSelectedUserId\(""\);/,
    "saving an edit should not close the selected user before refreshed permissions can render"
  );
});

test("successful user update refreshes the route and applies returned permissions immediately", () => {
  assert.match(source, /import \{ useRouter \} from "next\/navigation";/);
  assert.match(source, /const router = useRouter\(\);/);
  assert.match(source, /updateState\.revision/);
  assert.match(source, /setEditPermissions\(mergePermissions\(defaultPermissions, updatedUser\.permissions\)\);/);
  assert.match(source, /router\.refresh\(\);/);
});
