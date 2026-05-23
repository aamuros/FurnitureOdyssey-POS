import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { OperationalPdfDocument } from "@/lib/pdf/operational-document";
import { QuotationPdfDocument } from "@/lib/pdf/quotation-document";
import type { OperationalPdfData } from "@/lib/pdf/types";

export async function renderOperationalPdf(data: OperationalPdfData) {
  return renderToBuffer(<OperationalPdfDocument data={data} />);
}

export async function renderQuotationPdf(data: OperationalPdfData) {
  return renderToBuffer(<QuotationPdfDocument data={data} />);
}

