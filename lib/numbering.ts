import { DocumentType, type Prisma } from "@prisma/client";
import { APP_SETTINGS_KEY, documentPrefixForKind, normalizeAppSettings } from "@/lib/settings/get-settings";

type NumberingTx = Prisma.TransactionClient;

type NumberType =
  | "quotation"
  | "order"
  | "invoice"
  | "payment"
  | "deliveryReceipt"
  | "finalSummary";

type DocumentKind = Parameters<typeof documentPrefixForKind>[1];

const numberTypeToKind: Record<NumberType, DocumentKind> = {
  quotation: "quotation",
  order: "order",
  invoice: "invoice",
  payment: "payment-receipt",
  deliveryReceipt: "delivery-receipt",
  finalSummary: "final-order-summary"
};

async function getSettings(tx: NumberingTx) {
  const setting = await tx.appSetting.findUnique({
    where: {
      key: APP_SETTINGS_KEY
    },
    select: {
      value: true
    }
  });

  return normalizeAppSettings(setting?.value);
}

async function generateDocumentNumber(tx: NumberingTx, type: NumberType) {
  const year = new Date().getFullYear();
  const [settings, counter] = await Promise.all([
    getSettings(tx),
    tx.documentCounter.upsert({
      where: {
        type_year: {
          type,
          year
        }
      },
      create: {
        type,
        year,
        nextValue: 2
      },
      update: {
        nextValue: {
          increment: 1
        }
      }
    })
  ]);
  const prefix = documentPrefixForKind(settings, numberTypeToKind[type]);
  const value = counter.nextValue - 1;

  return `${prefix}-${year}-${value.toString().padStart(6, "0")}`;
}

export function generateQuotationNumber(tx: NumberingTx) {
  return generateDocumentNumber(tx, "quotation");
}

export function generateOrderNumber(tx: NumberingTx) {
  return generateDocumentNumber(tx, "order");
}

export function generateInvoiceNumber(tx: NumberingTx) {
  return generateDocumentNumber(tx, "invoice");
}

export function generatePaymentNumber(tx: NumberingTx) {
  return generateDocumentNumber(tx, "payment");
}

export function generateDeliveryReceiptNumber(tx: NumberingTx) {
  return generateDocumentNumber(tx, "deliveryReceipt");
}

export function generateFinalSummaryNumber(tx: NumberingTx) {
  return generateDocumentNumber(tx, "finalSummary");
}

function generatedDocumentWhere(input: {
  orderId: string;
  documentType: DocumentType;
  paymentId?: string | null;
  deliveryId?: string | null;
}) {
  return {
    orderId: input.orderId,
    documentType: input.documentType,
    paymentId: input.paymentId ?? null,
    deliveryId: input.deliveryId ?? null,
    status: {
      not: "VOIDED" as const
    }
  };
}

export async function ensureOrderDocumentNumber(
  tx: NumberingTx,
  input: {
    orderId: string;
    quotationId?: string | null;
    paymentId?: string | null;
    deliveryId?: string | null;
    documentType: DocumentType;
    numberType: NumberType;
    title: string;
    generatedById?: string | null;
    existingNumber?: string | null;
  }
) {
  const existingDocument = await tx.orderDocument.findFirst({
    where: generatedDocumentWhere(input),
    orderBy: {
      createdAt: "asc"
    },
    select: {
      id: true,
      documentNumber: true
    }
  });

  if (existingDocument?.documentNumber) {
    return existingDocument.documentNumber;
  }

  const documentNumber = input.existingNumber ?? (await generateDocumentNumber(tx, input.numberType));

  if (existingDocument) {
    await tx.orderDocument.update({
      where: {
        id: existingDocument.id
      },
      data: {
        documentNumber,
        generatedAt: new Date(),
        generatedById: input.generatedById ?? undefined
      }
    });

    return documentNumber;
  }

  await tx.orderDocument.create({
    data: {
      orderId: input.orderId,
      quotationId: input.quotationId,
      paymentId: input.paymentId,
      deliveryId: input.deliveryId,
      documentType: input.documentType,
      documentNumber,
      title: input.title,
      generatedAt: new Date(),
      generatedById: input.generatedById
    }
  });

  return documentNumber;
}
