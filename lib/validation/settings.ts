import { z } from "zod";

const optionalText = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .transform((value) => (value.length ? value : ""))
    .optional()
    .default("");

const optionalUrl = z
  .string()
  .trim()
  .max(500, "Use 500 characters or fewer.")
  .refine((value) => {
    if (!value) {
      return true;
    }

    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, {
    message: "Enter a valid URL starting with http:// or https://, or leave blank."
  })
  .transform((value) => (value.length ? value : ""))
  .optional()
  .default("");

const prefix = z
  .string()
  .trim()
  .min(1, "Prefix is required.")
  .max(12, "Use 12 characters or fewer.")
  .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, or hyphens only.")
  .transform((value) => value.toUpperCase());

export const companyProfileSettingsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required.").max(120),
  registeredName: optionalText(160),
  address: optionalText(500),
  contactNumber: optionalText(80),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Enter a valid email address, or leave blank."
    })
    .transform((value) => (value.length ? value : ""))
    .optional()
    .default(""),
  facebookPage: optionalText(250),
  websiteUrl: optionalUrl,
  logoUrl: optionalUrl,
  logoAltText: optionalText(160)
});

export const paymentSettingsSchema = z.object({
  defaultPaymentInstructions: optionalText(1500),
  bankDetails: optionalText(1500),
  eWalletDetails: optionalText(1500),
  otherPaymentNotes: optionalText(1500),
  mopScript: optionalText(2000),
  pdfPaymentPolicyTitle: optionalText(160),
  pdfPaymentPolicyBullets: optionalText(3000),
  pdfPaymentHighlightNote: optionalText(1000),
  pdfBankDetailsTitle: optionalText(160),
  pdfBankDetails: optionalText(3000),
  pdfPaymentReceiptTermsTitle: optionalText(160),
  pdfPaymentReceiptTerms: optionalText(2000),
  pdfDeliveryReceiptTermsTitle: optionalText(160),
  pdfDeliveryReceiptTerms: optionalText(3000)
});

export const documentSettingsSchema = z.object({
  quotationFooter: optionalText(1500),
  invoiceFooter: optionalText(1500),
  paymentReceiptFooter: optionalText(1500),
  deliveryReceiptFooter: optionalText(1500),
  finalSummaryFooter: optionalText(1500),
  quotationPrefix: prefix,
  orderPrefix: prefix,
  invoicePrefix: prefix,
  paymentReceiptPrefix: prefix,
  deliveryReceiptPrefix: prefix,
  finalSummaryPrefix: prefix
});

export const appSettingsSchema = z.object({
  companyProfile: companyProfileSettingsSchema,
  payment: paymentSettingsSchema,
  documents: documentSettingsSchema
});

export type CompanyProfileSettingsInput = z.infer<typeof companyProfileSettingsSchema>;
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;
export type DocumentSettingsInput = z.infer<typeof documentSettingsSchema>;
export type AppSettingsInput = z.infer<typeof appSettingsSchema>;
