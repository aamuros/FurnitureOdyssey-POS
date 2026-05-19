"use client";

import { useActionState, useState } from "react";
import { Clipboard, Save } from "lucide-react";
import {
  updateCompanyProfileSettingsAction,
  updateDocumentSettingsAction,
  updatePaymentSettingsAction
} from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AppSettingsInput } from "@/lib/validation/settings";

type SettingsWorkspaceProps = {
  settings: AppSettingsInput;
  canUpdate: boolean;
};

type Section = "company" | "payment" | "documents";

const initialState = {
  ok: false,
  message: ""
};

const sections: Array<{ id: Section; label: string; description: string }> = [
  {
    id: "company",
    label: "Company Profile",
    description: "Business display details used in document headers and internal defaults."
  },
  {
    id: "payment",
    label: "Payment / MOP Details",
    description: "Reusable payment instructions and quick-copy message text."
  },
  {
    id: "documents",
    label: "Document / PDF Defaults",
    description: "Conservative footer notes and display prefixes for operational documents."
  }
];

function Field({
  label,
  helper,
  children
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {helper ? <span className="block text-xs leading-5 text-muted-foreground">{helper}</span> : null}
    </label>
  );
}

function FormMessage({ state }: { state: typeof initialState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={`rounded-md px-3 py-2 text-sm ${
        state.ok
          ? "border border-success/25 bg-success/10 text-success"
          : "border border-danger/25 bg-danger/10 text-danger"
      }`}
    >
      {state.message}
    </p>
  );
}

export function SettingsWorkspace({ settings, canUpdate }: SettingsWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<Section>("company");
  const [copyMessage, setCopyMessage] = useState("");
  const [companyState, companyAction, companyPending] = useActionState(
    updateCompanyProfileSettingsAction,
    initialState
  );
  const [paymentState, paymentAction, paymentPending] = useActionState(
    updatePaymentSettingsAction,
    initialState
  );
  const [documentState, documentAction, documentPending] = useActionState(
    updateDocumentSettingsAction,
    initialState
  );

  async function copyMopScript() {
    const script = settings.payment.mopScript.trim();

    if (!script) {
      setCopyMessage("No MOP script has been saved yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(script);
      setCopyMessage("MOP script copied.");
    } catch {
      setCopyMessage("Copy failed. Select the script text and copy manually.");
    }
  }

  return (
    <div className="space-y-6">
      <nav className="grid gap-3 lg:grid-cols-3" aria-label="Settings sections">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={`rounded-lg border p-4 text-left transition ${
              activeSection === section.id
                ? "border-primary bg-primary/5"
                : "border-border bg-panel hover:bg-muted"
            }`}
          >
            <span className="text-sm font-semibold">{section.label}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {section.description}
            </span>
          </button>
        ))}
      </nav>

      {activeSection === "company" ? (
        <section className="studio-card">
          <div className="studio-card-header">
            <p className="studio-kicker">Company Details</p>
            <h2 className="text-sm font-semibold">Company Profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These values appear in generated PDF headers when available. Blank fields use safe placeholders.
            </p>
          </div>
          <form action={companyAction} className="space-y-4 p-5">
            <fieldset disabled={!canUpdate || companyPending} className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name">
                <Input name="companyName" required defaultValue={settings.companyProfile.companyName} />
              </Field>
              <Field label="Registered / business display name" helper="Optional display name only.">
                <Input name="registeredName" defaultValue={settings.companyProfile.registeredName} />
              </Field>
              <Field label="Contact number">
                <Input name="contactNumber" defaultValue={settings.companyProfile.contactNumber} />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" defaultValue={settings.companyProfile.email} />
              </Field>
              <Field label="Facebook page URL or display name">
                <Input name="facebookPage" defaultValue={settings.companyProfile.facebookPage} />
              </Field>
              <Field label="Website URL" helper="Optional. Use http:// or https:// when supplied.">
                <Input name="websiteUrl" defaultValue={settings.companyProfile.websiteUrl} />
              </Field>
              <Field label="Logo secure image URL" helper="Optional Cloudinary or HTTPS image URL.">
                <Input name="logoUrl" defaultValue={settings.companyProfile.logoUrl} />
              </Field>
              <Field label="Logo alt text">
                <Input name="logoAltText" defaultValue={settings.companyProfile.logoAltText} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address">
                  <Textarea name="address" defaultValue={settings.companyProfile.address} />
                </Field>
              </div>
            </fieldset>
            <FormMessage state={companyState} />
            <Button type="submit" disabled={!canUpdate || companyPending}>
              <Save className="h-4 w-4" />
              {companyPending ? "Saving..." : "Save company profile"}
            </Button>
          </form>
        </section>
      ) : null}

      {activeSection === "payment" ? (
        <section className="studio-card">
          <div className="studio-card-header">
            <p className="studio-kicker">Payment Copy</p>
            <h2 className="text-sm font-semibold">Payment / MOP Details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Store reusable instructions only. This does not verify payments or connect to gateways.
            </p>
          </div>
          <form action={paymentAction} className="space-y-4 p-5">
            <fieldset disabled={!canUpdate || paymentPending} className="grid gap-4">
              <Field label="Default payment instructions">
                <Textarea
                  name="defaultPaymentInstructions"
                  defaultValue={settings.payment.defaultPaymentInstructions}
                />
              </Field>
              <Field label="Bank account details">
                <Textarea name="bankDetails" defaultValue={settings.payment.bankDetails} />
              </Field>
              <Field label="GCash / Maya / e-wallet details">
                <Textarea name="eWalletDetails" defaultValue={settings.payment.eWalletDetails} />
              </Field>
              <Field label="Other payment method notes">
                <Textarea name="otherPaymentNotes" defaultValue={settings.payment.otherPaymentNotes} />
              </Field>
              <Field label="Copyable MOP script text">
                <Textarea name="mopScript" defaultValue={settings.payment.mopScript} />
              </Field>
            </fieldset>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" disabled={!canUpdate || paymentPending}>
                <Save className="h-4 w-4" />
                {paymentPending ? "Saving..." : "Save payment details"}
              </Button>
              <Button type="button" variant="secondary" onClick={copyMopScript}>
                <Clipboard className="h-4 w-4" />
                Copy MOP script
              </Button>
            </div>
            <FormMessage state={paymentState} />
            {copyMessage ? <p className="text-sm text-muted-foreground">{copyMessage}</p> : null}
          </form>
        </section>
      ) : null}

      {activeSection === "documents" ? (
        <section className="studio-card">
          <div className="studio-card-header">
            <p className="studio-kicker">Document Footer</p>
            <h2 className="text-sm font-semibold">Document / PDF Defaults</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure display prefixes and footer notes. These are not legal, tax, BIR, or accounting compliance settings.
            </p>
          </div>
          <form action={documentAction} className="space-y-5 p-5">
            <fieldset disabled={!canUpdate || documentPending} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Quotation prefix">
                  <Input name="quotationPrefix" defaultValue={settings.documents.quotationPrefix} />
                </Field>
                <Field label="Order prefix">
                  <Input name="orderPrefix" defaultValue={settings.documents.orderPrefix} />
                </Field>
                <Field label="Invoice prefix">
                  <Input name="invoicePrefix" defaultValue={settings.documents.invoicePrefix} />
                </Field>
                <Field label="Payment receipt prefix">
                  <Input name="paymentReceiptPrefix" defaultValue={settings.documents.paymentReceiptPrefix} />
                </Field>
                <Field label="Delivery receipt prefix">
                  <Input name="deliveryReceiptPrefix" defaultValue={settings.documents.deliveryReceiptPrefix} />
                </Field>
                <Field label="Final summary prefix">
                  <Input name="finalSummaryPrefix" defaultValue={settings.documents.finalSummaryPrefix} />
                </Field>
              </div>
              <div className="grid gap-4">
                <Field label="Quotation footer / terms">
                  <Textarea name="quotationFooter" defaultValue={settings.documents.quotationFooter} />
                </Field>
                <Field label="Invoice footer / notes">
                  <Textarea name="invoiceFooter" defaultValue={settings.documents.invoiceFooter} />
                </Field>
                <Field label="Payment receipt footer / notes">
                  <Textarea
                    name="paymentReceiptFooter"
                    defaultValue={settings.documents.paymentReceiptFooter}
                  />
                </Field>
                <Field label="Delivery receipt footer / notes">
                  <Textarea
                    name="deliveryReceiptFooter"
                    defaultValue={settings.documents.deliveryReceiptFooter}
                  />
                </Field>
                <Field label="Final order summary footer / notes">
                  <Textarea name="finalSummaryFooter" defaultValue={settings.documents.finalSummaryFooter} />
                </Field>
              </div>
            </fieldset>
            <FormMessage state={documentState} />
            <Button type="submit" disabled={!canUpdate || documentPending}>
              <Save className="h-4 w-4" />
              {documentPending ? "Saving..." : "Save document defaults"}
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
