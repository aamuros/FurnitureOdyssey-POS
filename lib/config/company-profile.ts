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
  pdfPaymentPolicyTitle: "Payment Policy and Delivery Options",
  pdfPaymentPolicyBullets:
    "50% Payment required for reservation of orders. 50% remaining balance after 15 days.\nStandard lead time is 15-20 days; please allow up to 30 days for unforeseen delays.",
  pdfPaymentHighlightNote:
    "Items delivered/pickup will be considered good condition if no claim has been made within 7 days.",
  pdfBankDetailsTitle: "BANK DETAILS",
  pdfBankDetails:
    "security bank - padre faura\nAccount Name: JOHN JETHRO ARIZABAL/DHM ONLINE STORE\nAccount No.: 0000072788246",
  pdfPaymentReceiptTermsTitle: "Note:",
  pdfPaymentReceiptTerms:
    "This receipt acknowledges the payment recorded for the order shown above.\nPlease keep this document for your reference.",
  pdfDeliveryReceiptTermsTitle: "TERMS & CONDITION:",
  pdfDeliveryReceiptTerms:
    "Items delivered/pickup will be considered good condition if no claim has been made within 24 hours\nWarranty: Warranty covers factory defects only; change of mind is not accepted.\nInspection: The terms may require the buyer to inspect the goods immediately upon receipt and to note any damages or discrepancies on the receipt.",
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
  paymentReceiptPrefix: "PAY",
  deliveryReceiptPrefix: "DR",
  finalSummaryPrefix: "SUM"
} as const;

export type CompanyProfile = typeof companyProfile;
