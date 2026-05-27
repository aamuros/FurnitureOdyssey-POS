import assert from "node:assert/strict";
import test from "node:test";
import { assignedDueDeliveryWhere } from "@/lib/dashboard/operations";

test("staff dashboard due deliveries are scoped to assigned deliveries", () => {
  const tomorrowStart = new Date("2026-06-02T00:00:00.000Z");

  assert.deepEqual(assignedDueDeliveryWhere(tomorrowStart, "staff-1", false), {
    scheduledDate: {
      lt: tomorrowStart
    },
    status: {
      in: ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"]
    },
    assignedStaffId: "staff-1"
  });
});

test("admin dashboard due deliveries keep the all-deliveries view", () => {
  const tomorrowStart = new Date("2026-06-02T00:00:00.000Z");

  assert.deepEqual(assignedDueDeliveryWhere(tomorrowStart, "admin-1", true), {
    scheduledDate: {
      lt: tomorrowStart
    },
    status: {
      in: ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"]
    }
  });
});
