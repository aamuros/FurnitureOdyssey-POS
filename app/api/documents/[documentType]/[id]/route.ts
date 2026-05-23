import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/server";
import { getOperationalPdfData } from "@/lib/pdf/data";
import { renderOperationalPdf, renderQuotationPdf } from "@/lib/pdf/render";
import type { OperationalPdfKind } from "@/lib/pdf/types";

export const runtime = "nodejs";

const supportedTypes = new Set<OperationalPdfKind>([
  "quotation",
  "invoice",
  "payment-receipt",
  "delivery-receipt",
  "final-order-summary"
]);

type RouteParams = {
  params: Promise<{
    documentType: string;
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { documentType, id } = await params;

  if (!supportedTypes.has(documentType as OperationalPdfKind)) {
    notFound();
  }

  const kind = documentType as OperationalPdfKind;

  await requirePermission("DOCUMENTS", "EXPORT");

  if (kind === "quotation") {
    await requirePermission("QUOTATIONS", "VIEW");
  }

  if (kind === "invoice" || kind === "final-order-summary") {
    await requirePermission("ORDERS", "VIEW");
  }

  if (kind === "payment-receipt") {
    await requirePermission("PAYMENTS", "VIEW");
  }

  if (kind === "delivery-receipt") {
    await requirePermission("DELIVERIES", "VIEW");
  }

  const data = await getOperationalPdfData(kind, id);
  const buffer = kind === "quotation"
    ? await renderQuotationPdf(data)
    : await renderOperationalPdf(data);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.filename}"`,
      "Cache-Control": "private, no-store"
    }
  });
}

