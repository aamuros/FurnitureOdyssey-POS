export type OperationalPdfKind =
  | "quotation"
  | "invoice"
  | "payment-receipt"
  | "delivery-receipt"
  | "final-order-summary";

export type PdfSummaryRow = {
  label: string;
  value: string;
};

export type PdfItemRow = {
  code?: string | null;
  name: string;
  description?: string | null;
  quantity: string;
  unitPrice?: string;
  discount?: string;
  total?: string;
  notes?: string | null;
};

export type OperationalPdfData = {
  kind: OperationalPdfKind;
  title: string;
  filename: string;
  generatedAt: Date;
  company: {
    displayName: string;
    address?: string | null;
    contact?: string | null;
  };
  customer: {
    displayName: string;
    detail?: string | null;
    contact?: string | null;
    address?: string | null;
  };
  summary: PdfSummaryRow[];
  items?: PdfItemRow[];
  payments?: PdfSummaryRow[];
  deliveries?: PdfSummaryRow[];
  notes?: string | null;
};

