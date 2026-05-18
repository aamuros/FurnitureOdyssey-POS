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
  quantityDelivered?: string;
  unitPrice?: string;
  discount?: string;
  discountDetail?: string | null;
  total?: string;
  notes?: string | null;
  imageUrl?: string | null;
};

export type OperationalPdfData = {
  kind: OperationalPdfKind;
  title: string;
  subtitle?: string;
  filename: string;
  generatedAt: Date;
  company: {
    displayName: string;
    address?: string | null;
    contactNumber?: string | null;
    email?: string | null;
    facebookPage?: string | null;
    bankDetails?: string | null;
    paymentInstructions?: string | null;
    footer?: string | null;
  };
  customer: {
    displayName: string;
    detail?: string | null;
    contact?: string | null;
    address?: string | null;
  };
  summary: PdfSummaryRow[];
  totals?: PdfSummaryRow[];
  items?: PdfItemRow[];
  payments?: PdfSummaryRow[];
  deliveries?: PdfSummaryRow[];
  notes?: string | null;
  paymentInstructions?: string | null;
  footerNote?: string | null;
  signatureRequired?: boolean;
  assemblyTodo?: boolean;
};
