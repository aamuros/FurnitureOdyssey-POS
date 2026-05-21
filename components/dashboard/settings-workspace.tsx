"use client";

import { useActionState, useState } from "react";
import { Building2, Clipboard, CreditCard, FileText, ImageIcon, Save } from "lucide-react";
import {
  updateCompanyProfileSettingsAction,
  updateDocumentSettingsAction,
  updatePaymentSettingsAction
} from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AppSettingsInput } from "@/lib/validation/settings";
import { cn } from "@/lib/utils";

type SettingsWorkspaceProps = {
  settings: AppSettingsInput;
  canUpdate: boolean;
};

type Section = "company" | "payment" | "documents";
type CompanyProfileSettings = AppSettingsInput["companyProfile"];
type PaymentSettings = AppSettingsInput["payment"];
type DocumentSettings = AppSettingsInput["documents"];

const initialState = {
  ok: false,
  message: ""
};

const sections: Array<{
  id: Section;
  label: string;
  description: string;
  icon: typeof Building2;
}> = [
  {
    id: "company",
    label: "Company Profile",
    description: "Business identity and PDF header details.",
    icon: Building2
  },
  {
    id: "payment",
    label: "Payment Instructions",
    description: "Reusable payment notes and MOP copy.",
    icon: CreditCard
  },
  {
    id: "documents",
    label: "Document Defaults",
    description: "Document prefixes and footer notes.",
    icon: FileText
  }
];

const prefixPreviewItems: Array<{ label: string; field: keyof DocumentSettings }> = [
  { label: "Quotation", field: "quotationPrefix" },
  { label: "Order", field: "orderPrefix" },
  { label: "Invoice", field: "invoicePrefix" },
  { label: "Payment receipt", field: "paymentReceiptPrefix" },
  { label: "Delivery receipt", field: "deliveryReceiptPrefix" },
  { label: "Final summary", field: "finalSummaryPrefix" }
];

function Field({
  label,
  helper,
  children,
  className
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-2 text-sm font-medium", className)}>
      <span>{label}</span>
      {children}
      {helper ? <span className="block text-xs font-normal leading-4 text-muted-foreground">{helper}</span> : null}
    </label>
  );
}

function FormMessage({ state }: { state: typeof initialState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        state.ok
          ? "border border-success/25 bg-success/10 text-success"
          : "border border-danger/25 bg-danger/10 text-danger"
      )}
      role="status"
    >
      {state.message}
    </p>
  );
}

function SettingsSectionNav({
  activeSection,
  onChange
}: {
  activeSection: Section;
  onChange: (section: Section) => void;
}) {
  return (
    <nav
      className="flex flex-wrap gap-2 rounded-lg border border-border bg-panel p-2"
      aria-label="Settings sections"
      role="tablist"
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            className={cn(
              "flex min-h-10 flex-1 items-center gap-3 rounded-md border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-w-56",
              isActive
                ? "border-border bg-soft-accent text-foreground"
                : "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-accent" : "text-muted-foreground")} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{section.label}</span>
              <span className="hidden truncate text-xs font-normal text-muted-foreground lg:block">
                {section.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function SettingsNotice() {
  return (
    <div className="mx-5 mt-5 rounded-md border border-border bg-soft-accent/45 px-3 py-2 text-sm text-muted-foreground">
      You can view these settings, but you do not have permission to update them.
    </div>
  );
}

function SettingsSubpanel({
  title,
  description,
  children,
  className
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("studio-subpanel overflow-hidden", className)}>
      <div className="border-b border-border bg-soft-accent/25 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-4 p-4">{children}</div>
    </div>
  );
}

function SettingsFormFooter({
  state,
  pending,
  disabled,
  buttonLabel,
  pendingLabel = "Saving...",
  children
}: {
  state: typeof initialState;
  pending: boolean;
  disabled: boolean;
  buttonLabel: string;
  pendingLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-t border-border bg-panel/70 px-5 py-4">
      {state.message ? (
        <div className="mb-3">
          <FormMessage state={state} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={disabled || pending}>
          <Save className="h-4 w-4" />
          {pending ? pendingLabel : buttonLabel}
        </Button>
        {children}
        <p className="text-xs leading-5 text-muted-foreground">
          Changes apply to future generated documents where applicable.
        </p>
      </div>
    </div>
  );
}

function CompanyPreview({ company }: { company: CompanyProfileSettings }) {
  const contactLines = [company.contactNumber, company.email, company.websiteUrl, company.address].filter(Boolean);
  const logoUrl = company.logoUrl.trim();

  return (
    <SettingsSubpanel
      title="PDF header preview"
      description="Approximate layout used by generated document headers."
      className="h-fit"
    >
      <div className="rounded-lg border border-border bg-panel p-4">
        <div className="flex items-start gap-4">
          {logoUrl ? (
            <div
              className="h-16 w-16 shrink-0 rounded-md border border-border bg-muted bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${logoUrl})` }}
              aria-label={company.logoAltText || "Company logo preview"}
              role="img"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/55">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="break-words text-base font-semibold">{company.companyName || "Company name"}</p>
            {company.registeredName ? (
              <p className="mt-1 break-words text-sm text-muted-foreground">{company.registeredName}</p>
            ) : null}
            {contactLines.length ? (
              <div className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">
                {contactLines.map((line) => (
                  <p key={line} className="break-words">
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Contact details will appear here when supplied.</p>
            )}
          </div>
        </div>
      </div>
    </SettingsSubpanel>
  );
}

function PaymentPreview({
  script,
  copyMessage,
  onCopy
}: {
  script: string;
  copyMessage: string;
  onCopy: () => void;
}) {
  const trimmedScript = script.trim();

  return (
    <SettingsSubpanel title="MOP script preview" description="Quick-copy text for customer payment instructions.">
      {trimmedScript ? (
        <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/45 p-3 text-sm leading-6 text-foreground">
          {trimmedScript}
        </div>
      ) : (
        <div className="studio-empty px-4 py-5 text-sm">
          Add a MOP script to preview and copy customer-facing payment text.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={onCopy}>
          <Clipboard className="h-4 w-4" />
          Copy MOP script
        </Button>
        {copyMessage ? <p className="text-sm text-muted-foreground">{copyMessage}</p> : null}
      </div>
    </SettingsSubpanel>
  );
}

function DocumentPrefixPreview({ documents }: { documents: DocumentSettings }) {
  return (
    <SettingsSubpanel title="Label preview" description="Examples use the current prefix values.">
      <div className="grid gap-2">
        {prefixPreviewItems.map((item) => {
          const prefix = documents[item.field].trim() || item.label.slice(0, 3).toUpperCase();

          return (
            <div
              key={item.field}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/35 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono font-semibold">{prefix}-0001</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        These are display defaults only, not legal, tax, BIR, or accounting compliance settings.
      </p>
    </SettingsSubpanel>
  );
}

export function SettingsWorkspace({ settings, canUpdate }: SettingsWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<Section>("company");
  const [copyMessage, setCopyMessage] = useState("");
  const [companyDraft, setCompanyDraft] = useState<CompanyProfileSettings>(settings.companyProfile);
  const [paymentDraft, setPaymentDraft] = useState<PaymentSettings>(settings.payment);
  const [documentDraft, setDocumentDraft] = useState<DocumentSettings>(settings.documents);
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

  function updateCompanyField(field: keyof CompanyProfileSettings, value: string) {
    setCompanyDraft((current) => ({ ...current, [field]: value }));
  }

  function updatePaymentField(field: keyof PaymentSettings, value: string) {
    setPaymentDraft((current) => ({ ...current, [field]: value }));
  }

  function updateDocumentField(field: keyof DocumentSettings, value: string) {
    setDocumentDraft((current) => ({ ...current, [field]: value }));
  }

  async function copyMopScript() {
    const script = paymentDraft.mopScript.trim();

    if (!script) {
      setCopyMessage("Add a MOP script before copying.");
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
      <SettingsSectionNav activeSection={activeSection} onChange={setActiveSection} />

      {activeSection === "company" ? (
        <section className="studio-card">
          <div className="studio-card-header">
            <p className="studio-kicker">Company Details</p>
            <h2 className="text-sm font-semibold">Company Profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Business identity and contact details used in generated PDFs when available.
            </p>
          </div>
          {!canUpdate ? <SettingsNotice /> : null}
          <form action={companyAction}>
            <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <fieldset disabled={!canUpdate || companyPending} className="grid gap-5">
                <SettingsSubpanel title="Business identity">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Company name">
                      <Input
                        name="companyName"
                        required
                        value={companyDraft.companyName}
                        onChange={(event) => updateCompanyField("companyName", event.target.value)}
                      />
                    </Field>
                    <Field label="Registered business name" helper="Optional display name for formal documents.">
                      <Input
                        name="registeredName"
                        value={companyDraft.registeredName}
                        onChange={(event) => updateCompanyField("registeredName", event.target.value)}
                      />
                    </Field>
                  </div>
                </SettingsSubpanel>

                <SettingsSubpanel title="Contact details">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Contact number">
                      <Input
                        name="contactNumber"
                        type="tel"
                        value={companyDraft.contactNumber}
                        onChange={(event) => updateCompanyField("contactNumber", event.target.value)}
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        name="email"
                        type="email"
                        value={companyDraft.email}
                        onChange={(event) => updateCompanyField("email", event.target.value)}
                      />
                    </Field>
                    <Field label="Address" className="md:col-span-2">
                      <Textarea
                        name="address"
                        value={companyDraft.address}
                        onChange={(event) => updateCompanyField("address", event.target.value)}
                        className="h-28 resize-y"
                      />
                    </Field>
                  </div>
                </SettingsSubpanel>

                <SettingsSubpanel title="Online presence">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Facebook page URL or display name">
                      <Input
                        name="facebookPage"
                        value={companyDraft.facebookPage}
                        onChange={(event) => updateCompanyField("facebookPage", event.target.value)}
                      />
                    </Field>
                    <Field label="Website URL" helper="Use http:// or https:// when supplied.">
                      <Input
                        name="websiteUrl"
                        type="url"
                        value={companyDraft.websiteUrl}
                        onChange={(event) => updateCompanyField("websiteUrl", event.target.value)}
                      />
                    </Field>
                  </div>
                </SettingsSubpanel>

                <SettingsSubpanel title="Branding" description="Use Cloudinary or another HTTPS image URL.">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Logo image URL">
                      <Input
                        name="logoUrl"
                        type="url"
                        value={companyDraft.logoUrl}
                        onChange={(event) => updateCompanyField("logoUrl", event.target.value)}
                      />
                    </Field>
                    <Field label="Logo alt text">
                      <Input
                        name="logoAltText"
                        value={companyDraft.logoAltText}
                        onChange={(event) => updateCompanyField("logoAltText", event.target.value)}
                      />
                    </Field>
                  </div>
                </SettingsSubpanel>
              </fieldset>

              <CompanyPreview company={companyDraft} />
            </div>
            <SettingsFormFooter
              state={companyState}
              pending={companyPending}
              disabled={!canUpdate}
              buttonLabel="Save company profile"
            />
          </form>
        </section>
      ) : null}

      {activeSection === "payment" ? (
        <section className="studio-card">
          <div className="studio-card-header">
            <p className="studio-kicker">Payment Copy</p>
            <h2 className="text-sm font-semibold">Payment Instructions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Store reusable instructions only. This does not verify payments or connect to gateways.
            </p>
          </div>
          {!canUpdate ? <SettingsNotice /> : null}
          <form action={paymentAction}>
            <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <fieldset disabled={!canUpdate || paymentPending} className="grid gap-5">
                <SettingsSubpanel title="Customer-facing instructions">
                  <Field label="Default payment instructions">
                    <Textarea
                      name="defaultPaymentInstructions"
                      value={paymentDraft.defaultPaymentInstructions}
                      onChange={(event) => updatePaymentField("defaultPaymentInstructions", event.target.value)}
                      className="h-32 resize-y"
                    />
                  </Field>
                  <Field label="Copyable MOP script text" helper="Used by the copy button and preview panel.">
                    <Textarea
                      name="mopScript"
                      value={paymentDraft.mopScript}
                      onChange={(event) => {
                        updatePaymentField("mopScript", event.target.value);
                        setCopyMessage("");
                      }}
                      className="h-36 resize-y"
                    />
                  </Field>
                </SettingsSubpanel>

                <SettingsSubpanel title="Payment channels">
                  <Field label="Bank account details">
                    <Textarea
                      name="bankDetails"
                      value={paymentDraft.bankDetails}
                      onChange={(event) => updatePaymentField("bankDetails", event.target.value)}
                      className="h-28 resize-y"
                    />
                  </Field>
                  <Field label="GCash / Maya / e-wallet details">
                    <Textarea
                      name="eWalletDetails"
                      value={paymentDraft.eWalletDetails}
                      onChange={(event) => updatePaymentField("eWalletDetails", event.target.value)}
                      className="h-28 resize-y"
                    />
                  </Field>
                  <Field label="Other payment method notes">
                    <Textarea
                      name="otherPaymentNotes"
                      value={paymentDraft.otherPaymentNotes}
                      onChange={(event) => updatePaymentField("otherPaymentNotes", event.target.value)}
                      className="h-28 resize-y"
                    />
                  </Field>
                </SettingsSubpanel>
              </fieldset>

              <PaymentPreview script={paymentDraft.mopScript} copyMessage={copyMessage} onCopy={copyMopScript} />
            </div>
            <SettingsFormFooter
              state={paymentState}
              pending={paymentPending}
              disabled={!canUpdate}
              buttonLabel="Save payment details"
            />
          </form>
        </section>
      ) : null}

      {activeSection === "documents" ? (
        <section className="studio-card">
          <div className="studio-card-header">
            <p className="studio-kicker">Document Footer</p>
            <h2 className="text-sm font-semibold">Document Defaults</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure document display prefixes and reusable footer notes.
            </p>
          </div>
          {!canUpdate ? <SettingsNotice /> : null}
          <form action={documentAction}>
            <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <fieldset disabled={!canUpdate || documentPending} className="grid gap-5">
                <SettingsSubpanel
                  title="Document number prefixes"
                  description="Prefixes are short display labels used before generated numbers."
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Quotation prefix">
                      <Input
                        name="quotationPrefix"
                        value={documentDraft.quotationPrefix}
                        onChange={(event) => updateDocumentField("quotationPrefix", event.target.value)}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Order prefix">
                      <Input
                        name="orderPrefix"
                        value={documentDraft.orderPrefix}
                        onChange={(event) => updateDocumentField("orderPrefix", event.target.value)}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Invoice prefix">
                      <Input
                        name="invoicePrefix"
                        value={documentDraft.invoicePrefix}
                        onChange={(event) => updateDocumentField("invoicePrefix", event.target.value)}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Payment receipt prefix">
                      <Input
                        name="paymentReceiptPrefix"
                        value={documentDraft.paymentReceiptPrefix}
                        onChange={(event) => updateDocumentField("paymentReceiptPrefix", event.target.value)}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Delivery receipt prefix">
                      <Input
                        name="deliveryReceiptPrefix"
                        value={documentDraft.deliveryReceiptPrefix}
                        onChange={(event) => updateDocumentField("deliveryReceiptPrefix", event.target.value)}
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Final summary prefix">
                      <Input
                        name="finalSummaryPrefix"
                        value={documentDraft.finalSummaryPrefix}
                        onChange={(event) => updateDocumentField("finalSummaryPrefix", event.target.value)}
                        className="font-mono"
                      />
                    </Field>
                  </div>
                </SettingsSubpanel>

                <SettingsSubpanel title="Footer notes">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="Quotation footer / terms">
                      <Textarea
                        name="quotationFooter"
                        value={documentDraft.quotationFooter}
                        onChange={(event) => updateDocumentField("quotationFooter", event.target.value)}
                        className="h-32 resize-y"
                      />
                    </Field>
                    <Field label="Invoice footer / notes">
                      <Textarea
                        name="invoiceFooter"
                        value={documentDraft.invoiceFooter}
                        onChange={(event) => updateDocumentField("invoiceFooter", event.target.value)}
                        className="h-32 resize-y"
                      />
                    </Field>
                    <Field label="Payment receipt footer / notes">
                      <Textarea
                        name="paymentReceiptFooter"
                        value={documentDraft.paymentReceiptFooter}
                        onChange={(event) => updateDocumentField("paymentReceiptFooter", event.target.value)}
                        className="h-32 resize-y"
                      />
                    </Field>
                    <Field label="Delivery receipt footer / notes">
                      <Textarea
                        name="deliveryReceiptFooter"
                        value={documentDraft.deliveryReceiptFooter}
                        onChange={(event) => updateDocumentField("deliveryReceiptFooter", event.target.value)}
                        className="h-32 resize-y"
                      />
                    </Field>
                    <Field label="Final order summary footer / notes" className="lg:col-span-2">
                      <Textarea
                        name="finalSummaryFooter"
                        value={documentDraft.finalSummaryFooter}
                        onChange={(event) => updateDocumentField("finalSummaryFooter", event.target.value)}
                        className="h-32 resize-y"
                      />
                    </Field>
                  </div>
                </SettingsSubpanel>
              </fieldset>

              <DocumentPrefixPreview documents={documentDraft} />
            </div>
            <SettingsFormFooter
              state={documentState}
              pending={documentPending}
              disabled={!canUpdate}
              buttonLabel="Save document defaults"
            />
          </form>
        </section>
      ) : null}
    </div>
  );
}
