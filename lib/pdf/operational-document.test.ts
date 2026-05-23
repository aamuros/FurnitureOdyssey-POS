import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { defaultPdfLogoPath, defaultPdfLogoSource } from "@/lib/pdf/assets";
import { companyForPdf } from "@/lib/pdf/data";
import { formatMoney, shouldDisplayPdfAmountRow } from "@/lib/pdf/formatters";
import { renderOperationalPdf, renderQuotationPdf } from "@/lib/pdf/render";
import { defaultAppSettings } from "@/lib/settings/get-settings";
import type { OperationalPdfData } from "@/lib/pdf/types";

test("default PDF logo resolves to a local tracked image asset", () => {
  const logoPath = defaultPdfLogoPath();
  const logoSource = defaultPdfLogoSource();

  assert.match(logoPath, /public[\\/]logo[\\/]dream-home-mnl-logo\.png$/);
  assert.equal(existsSync(logoPath), true);
  assert.ok(logoSource, "default PDF logo source should be configured");
  assert.match(logoSource, /^data:image\/png;base64,/);
});

test("PDF company data falls back to the bundled logo when settings have no logo URL", () => {
  const company = companyForPdf({
    ...defaultAppSettings,
    companyProfile: {
      ...defaultAppSettings.companyProfile,
      logoUrl: ""
    }
  });

  assert.equal(company.logoUrl, defaultPdfLogoSource());
  assert.equal(company.logoAltText, "Furniture Odyssey logo");
});

test("PDF company data suppresses placeholder settings", () => {
  const company = companyForPdf(defaultAppSettings);

  assert.equal(company.address, null);
  assert.equal(company.contactNumber, null);
  assert.equal(company.facebookPage, null);
  assert.equal(company.bankDetails, null);
  assert.equal(company.paymentInstructions, null);
});

test("PDF money formatting uses clean ASCII currency text without sign glyphs", () => {
  assert.equal(formatMoney(1500, "PHP"), "PHP 1,500.00");
  assert.equal(formatMoney(100, "PHP"), "PHP 100.00");
  assert.doesNotMatch(formatMoney(1500, "PHP"), /(?:\+\/-|\+-|±|₱)/);
});

test("shared operational PDF template uses the branded stationery sections on A4 without the old grid", () => {
  const source = readFileSync("lib/pdf/operational-document.tsx", "utf8");
  const sharedSource = readFileSync("lib/pdf/dream-home-layout.tsx", "utf8");

  assert.match(source, /<Page size="A4"/);
  assert.match(source, /<DreamHomeHeader/);
  assert.doesNotMatch(source, /<DreamHomeHeader[^>]*compact/);
  assert.match(source, /DreamHomePolicies/);
  assert.match(source, /DreamHomePreparedBy/);
  assert.match(source, /Issued To:/);
  assert.match(source, /documentDate/);
  assert.match(source, /BUYER\/RECEIVER SIGNATURE AND DATE/);
  assert.match(source, /I HEREBY ACKNOWLEDGE/);
  assert.match(source, /tableHeader:\s*\{[\s\S]*backgroundColor:\s*accent/);
  assert.match(sharedSource, /dream-home-mnl-logo\.png/);
  assert.match(sharedSource, /Font\.register/);
  assert.match(sharedSource, /DREAM HOME MNL/);
  assert.doesNotMatch(sharedSource, /compact(?:Header|Logo|CompanyName|Tagline|DocumentTitle)/);
  assert.doesNotMatch(source, /Document Details/);
  assert.doesNotMatch(source, /data\.subtitle \|\|/);
  assert.doesNotMatch(source, /fallbackText/);
  assert.doesNotMatch(source, /zIndex:/);
});

test("shared operational PDF template maps every downloadable document type to a stationery label", () => {
  const source = readFileSync("lib/pdf/dream-home-layout.tsx", "utf8");

  assert.match(source, /return "Product Quotation"/);
  assert.match(source, /return "Sales Invoice"/);
  assert.match(source, /return "Payment Receipt"/);
  assert.match(source, /return "Delivery Receipt"/);
  assert.match(source, /return "Final Order Summary"/);
});

test("PDF amount rows hide sales invoice fees and zero money rows while keeping final totals", () => {
  assert.equal(shouldDisplayPdfAmountRow({ label: "Sales Invoice Fee", value: "PHP 968.80" }), false);
  assert.equal(
    shouldDisplayPdfAmountRow(
      { label: "Additional Fees", value: "PHP 0.00" },
      { hideZeroMoneyRows: true }
    ),
    false
  );
  assert.equal(
    shouldDisplayPdfAmountRow(
      { label: "Additional Discount", value: "-PHP 0.00" },
      { hideZeroMoneyRows: true }
    ),
    false
  );
  assert.equal(
    shouldDisplayPdfAmountRow(
      { label: "Assembly Fee", value: "PHP 1,000.00" },
      { hideZeroMoneyRows: true }
    ),
    true
  );
  assert.equal(
    shouldDisplayPdfAmountRow(
      { label: "Final Total", value: "PHP 0.00" },
      { alwaysShowLabels: [/^final total$/i], hideZeroMoneyRows: true }
    ),
    true
  );
});

test("Dream Home quotation PDF uses the uploaded logo path and does not render a visible quotation number", async () => {
  const source = readFileSync("lib/pdf/quotation-document.tsx", "utf8");
  const sharedSource = readFileSync("lib/pdf/dream-home-layout.tsx", "utf8");

  assert.match(sharedSource, /public", "logo", "dream-home-mnl-logo\.png"/);
  assert.doesNotMatch(source, /public", "pdf", "dream-home-mnl-logo\.png"/);
  assert.doesNotMatch(source, /Quotation No\./);

  const buffer = await renderQuotationPdf({
    ...sampleQuotationData(),
    totals: [
      { label: "Subtotal for Items", value: "PHP 11,110.00" },
      { label: "Additional Fees", value: "PHP 0.00" },
      { label: "Additional Discount", value: "-PHP 0.00" },
      { label: "Sales Invoice Fee", value: "PHP 968.80" },
      { label: "Final Total", value: "PHP 13,078.80" }
    ]
  });

  assert.ok(buffer.length > 1000);
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
});

test("React-PDF renderer can produce a logo-branded A4 operational PDF buffer", async () => {
  const data = sampleQuotationData();

  const buffer = await renderOperationalPdf(data);

  assert.ok(buffer.length > 1000);
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
});

test("typical final order summary keeps the signature on a single A4 page", async () => {
  const buffer = await renderOperationalPdf(finalOrderSummaryData());

  assert.equal(countPdfPages(buffer), 1);
});

function sampleQuotationData(): OperationalPdfData {
  return {
    kind: "quotation",
    title: "Quotation",
    subtitle: "Furniture quotation for review and approval",
    filename: "sample-quotation.pdf",
    generatedAt: new Date("2026-05-22T06:00:00Z"),
    company: companyForPdf(defaultAppSettings),
    customer: {
      displayName: "Sample Customer",
      detail: "Company Client",
      contact: "Mobile: 0917 111 2222",
      address: "Sample delivery address"
    },
    summary: [
      { label: "Quotation number", value: "QT-SAMPLE" },
      { label: "Quotation date", value: "May 22, 2026" }
    ],
    items: [
      {
        code: "FO-CHAIR",
        name: "Dining Chair",
        description: "Walnut finish, upholstered seat",
        quantity: "4",
        unitPrice: "PHP 2,500.00",
        discount: "PHP 0.00",
        total: "PHP 10,000.00"
      }
    ],
    totals: [{ label: "Total", value: "PHP 10,000.00" }],
    footerNote: "Generated for Furniture Odyssey sales operations."
  };
}

function finalOrderSummaryData(): OperationalPdfData {
  return {
    kind: "final-order-summary",
    title: "Final Order Summary",
    subtitle: "Order, payment, and delivery record",
    filename: "sample-final-order-summary.pdf",
    generatedAt: new Date("2026-05-22T06:00:00Z"),
    company: {
      displayName: "Furniture Odyssey",
      registeredName: "Furniture and Home Furnishings",
      address: "123 Sample Avenue, Quezon City",
      contactNumber: "0917 000 0000",
      email: "sales@example.com",
      facebookPage: "facebook.com/furnitureodyssey",
      logoUrl: null,
      bankDetails: "Sample Bank - Account 0000 0000",
      paymentInstructions: "Please settle payment before delivery.",
      footer: null
    },
    customer: {
      displayName: "Sample Customer",
      detail: "Company Client - Purchasing Team",
      contact: "Mobile: 0917 111 2222",
      address: "123 Sample Street, Makati City"
    },
    summary: [
      { label: "Final summary number", value: "SUM-SAMPLE" },
      { label: "Order", value: "ORD-SAMPLE" },
      { label: "Order date", value: "May 22, 2026" },
      { label: "Status", value: "Confirmed" },
      { label: "Payment status", value: "Partially Paid" },
      { label: "Delivery status", value: "Scheduled" },
      { label: "Payment due timing", value: "On Delivery" },
      { label: "Payment due date", value: "May 25, 2026" },
      { label: "Needs assemble", value: "Yes" },
      { label: "Sales invoice requested", value: "Yes" },
      { label: "Mode of delivery", value: "Company-arranged" },
      { label: "Delivery method", value: "In-house" },
      { label: "Payment terms", value: "50% downpayment, balance on delivery" },
      { label: "Special instructions", value: "Call before delivery" }
    ],
    items: [
      {
        code: "FO-SOFA",
        name: "Custom Sofa",
        description: "Linen fabric, walnut legs",
        quantity: "1",
        unitPrice: "PHP 18,000.00",
        discount: "PHP 500.00",
        total: "PHP 17,500.00"
      },
      {
        code: "FO-TABLE",
        name: "Coffee Table",
        description: "Round top, natural finish",
        quantity: "1",
        unitPrice: "PHP 7,000.00",
        discount: "PHP 0.00",
        total: "PHP 7,000.00"
      }
    ],
    totals: [
      { label: "Subtotal for Items", value: "PHP 25,000.00" },
      { label: "Item discounts", value: "PHP 500.00" },
      { label: "Order discount", value: "PHP 0.00" },
      { label: "Total", value: "PHP 24,500.00" },
      { label: "Paid", value: "PHP 10,000.00" },
      { label: "Balance", value: "PHP 14,500.00" }
    ],
    payments: [{ label: "May 22, 2026", value: "Downpayment - PHP 10,000.00" }],
    deliveries: [{ label: "May 25, 2026", value: "Scheduled - In-house" }],
    notes: "Sample customer-facing note.",
    paymentInstructions: "Please settle payment before delivery.",
    footerNote: "This final order summary is generated for Furniture Odyssey sales operations."
  };
}

function countPdfPages(buffer: Buffer) {
  return buffer.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}
