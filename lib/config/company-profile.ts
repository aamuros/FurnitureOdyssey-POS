export const companyProfile = {
  name: "Furniture Odyssey",
  address: "Company address placeholder",
  contactNumber: "Contact number placeholder",
  email: "Email placeholder",
  facebookPage: "Facebook page placeholder",
  bankDetails: "Bank/account details placeholder",
  defaultPaymentInstructions: "Default payment instructions placeholder",
  documentFooter:
    "This document is generated for Furniture Odyssey sales operations. Please review item details, delivery schedule, and payment instructions with your sales representative."
} as const;

export type CompanyProfile = typeof companyProfile;
