export const companyProfile = {
  name: "Furniture Odyssey",
  registeredName: "",
  address: "Company address placeholder",
  contactNumber: "Contact number placeholder",
  email: "",
  facebookPage: "Facebook page placeholder",
  websiteUrl: "",
  logoUrl: "",
  logoAltText: "Furniture Odyssey logo",
  bankDetails: "Bank/account details placeholder",
  eWalletDetails: "",
  otherPaymentNotes: "",
  mopScript: "Hi! You may settle payment through our available payment methods. Please send the payment reference or screenshot after payment so our team can record it.",
  defaultPaymentInstructions: "Default payment instructions placeholder",
  quotationFooter:
    "This quotation is for review and confirmation. Please verify item details, pricing, and delivery notes with your sales representative.",
  invoiceFooter:
    "This invoice summary is generated for Furniture Odyssey sales operations and does not claim tax or accounting compliance.",
  paymentReceiptFooter:
    "This payment receipt confirms a payment recorded in the Furniture Odyssey internal sales system.",
  deliveryReceiptFooter:
    "Please review delivered items before signing. Delivery concerns should be raised with your sales representative.",
  finalSummaryFooter:
    "This final order summary is generated for Furniture Odyssey sales operations.",
  documentFooter:
    "This document is generated for Furniture Odyssey sales operations. Please review item details, delivery schedule, and payment instructions with your sales representative.",
  quotationPrefix: "QT",
  orderPrefix: "ORD",
  invoicePrefix: "INV",
  paymentReceiptPrefix: "PR",
  deliveryReceiptPrefix: "DR",
  finalSummaryPrefix: "SUM"
} as const;

export type CompanyProfile = typeof companyProfile;
