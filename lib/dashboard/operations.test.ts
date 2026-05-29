import assert from "node:assert/strict";
import test from "node:test";
import { assignedDueDeliveryWhere } from "@/lib/dashboard/operations";

test("staff dashboard due deliveries are scoped to assigned deliveries", () => {
  const dateRange = {
    gte: new Date("2026-06-01T00:00:00.000Z"),
    lte: new Date("2026-06-01T23:59:59.999Z")
  };

  assert.deepEqual(assignedDueDeliveryWhere(dateRange, "staff-1", false), {
    scheduledDate: dateRange,
    status: {
      in: ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"]
    },
    assignedStaffId: "staff-1"
  });
});

test("admin dashboard due deliveries keep the all-deliveries view", () => {
  const dateRange = {
    gte: new Date("2026-06-01T00:00:00.000Z"),
    lte: new Date("2026-06-01T23:59:59.999Z")
  };

  assert.deepEqual(assignedDueDeliveryWhere(dateRange, "admin-1", true), {
    scheduledDate: dateRange,
    status: {
      in: ["PLANNED", "SCHEDULED", "IN_TRANSIT", "PARTIALLY_DELIVERED"]
    }
  });
});
