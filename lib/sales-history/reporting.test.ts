import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderWhere,
  canAccessReportView,
  orderListSelect,
  overviewSalesAggregateArgs,
  parseReportFilters,
  reportViews,
  unfinishedOrderWhere,
  type ReportPermissions
} from "./reporting";

const basePermissions: ReportPermissions = {
  canViewQuotations: true,
  canViewOrders: true,
  canViewPayments: true,
  canViewDeliveries: true,
  canViewCustomers: true,
  canViewInquiries: true,
  canViewDocuments: true,
  canExportDocuments: true
};

function withoutPayments(): ReportPermissions {
  return {
    ...basePermissions,
    canViewPayments: false
  };
}

function withoutDeliveries(): ReportPermissions {
  return {
    ...basePermissions,
    canViewDeliveries: false
  };
}

test("overview sales aggregate excludes cost and profit fields", () => {
  const aggregate = overviewSalesAggregateArgs({ createdAt: undefined, createdById: undefined });
  const encoded = JSON.stringify(aggregate);

  assert.match(encoded, /totalAmount/);
  assert.doesNotMatch(encoded, /totalCostAmount/);
  assert.doesNotMatch(encoded, /grossProfitAmount/);
  assert.doesNotMatch(encoded, /grossMargin/);
});

test("sales history exposes only reporting views", () => {
  assert.deepEqual(
    reportViews.map((view) => view.value),
    ["overview", "unfinished", "balances", "orders"]
  );
  assert.deepEqual(
    reportViews.map((view) => view.label),
    ["Overview", "Needs Action", "Balances", "Sales Ledger"]
  );
});

test("cancelled orders are counted separately and excluded from sales total", () => {
  const aggregate = overviewSalesAggregateArgs({});

  assert.deepEqual(aggregate.where, {
    status: {
      not: "CANCELLED"
    }
  });
});

test("unfinished orders exclude completed and cancelled statuses", () => {
  const where = unfinishedOrderWhere();

  assert.deepEqual(where.status, {
    notIn: ["COMPLETED", "CANCELLED"]
  });
});

test("order list select omits payment and balance fields without payment permission", () => {
  const select = orderListSelect(withoutPayments());
  const encoded = JSON.stringify(select);

  assert.doesNotMatch(encoded, /paymentStatus/);
  assert.doesNotMatch(encoded, /paymentDueDate/);
  assert.doesNotMatch(encoded, /paymentDueTiming/);
  assert.doesNotMatch(encoded, /paidAmount/);
  assert.doesNotMatch(encoded, /balanceAmount/);
  assert.doesNotMatch(encoded, /lastPaymentAt/);
  assert.doesNotMatch(encoded, /totalCostAmount/);
  assert.doesNotMatch(encoded, /grossProfitAmount/);
});

test("delivery schedule data require delivery permission", () => {
  const permissions = withoutDeliveries();
  const select = orderListSelect(permissions);

  assert.equal(select.deliveries, false);
});

test("balances require payment permission", () => {
  assert.equal(canAccessReportView("balances", withoutPayments()), false);
});

test("order query ignores restricted payment filters without payment permission", () => {
  const where = buildOrderWhere({
    query: undefined,
    status: undefined,
    paymentStatus: "PARTIALLY_PAID",
    deliveryStatus: undefined,
    staffId: undefined,
    dateRange: undefined,
    hasBalance: true,
    unfinishedOnly: false,
    overdueOnly: false,
    canUsePaymentFields: false,
    canUseDeliveryFields: true
  });

  assert.deepEqual(where, {});
});

test("report query params are bounded and validated", () => {
  const filters = parseReportFilters({
    view: "orders",
    q: ` ${"x".repeat(120)} `,
    page: "999999",
    staffId: "not-a-uuid",
    from: "2026-05-30",
    to: "2026-05-01",
    paymentStatus: "NOT_REAL"
  });

  assert.equal(filters.query?.length, 100);
  assert.equal(filters.page, 500);
  assert.equal(filters.staffId, undefined);
  assert.equal(filters.dateRange, undefined);
  assert.equal(filters.paymentStatus, undefined);
});
