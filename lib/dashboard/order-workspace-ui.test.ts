import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("components/dashboard/order-workspace.tsx", "utf8");

test("schedule delivery uses a styled custom time dropdown instead of native time picker", () => {
  assert.match(source, /function parseDeliveryStartTime/);
  assert.match(source, /function DeliveryTimePicker/);
  assert.match(source, /Select time/);
  assert.match(source, /<input type="hidden" name="scheduledStartTime" value={scheduledStartTime} \/>/);
  assert.match(source, /Enter delivery start time like 02:30 PM or 14:30\./);
  assert.doesNotMatch(source, /name="scheduledEndTime"/);
  assert.doesNotMatch(source, /type="time"/);
  assert.doesNotMatch(source, /Morning|Afternoon|Evening/);
});
