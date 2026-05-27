"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createCustomerAction,
  deleteCustomerAction,
  updateCustomerAction
} from "@/app/actions/customer-inquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { usePersistentPageState } from "@/lib/use-persistent-page-state";
import { cn } from "@/lib/utils";

type CustomerRow = {
  id: string;
  displayName: string;
  customerType: "INDIVIDUAL" | "COMPANY";
  companyName: string | null;
  contactPersonName: string | null;
  primaryContact: string | null;
  contactValues: string[];
  contacts: CustomerContactRow[];
  source: string | null;
  assignedStaff: string | null;
  assignedStaffId: string | null;
  notes: string | null;
  updatedAt: string;
};

type ContactDraft = {
  type: "PHONE" | "VIBER" | "FACEBOOK_PROFILE" | "FACEBOOK_PAGE" | "EMAIL" | "OTHER";
  label: string;
  value: string;
  isPrimary: boolean;
  notes: string;
};

type CustomerWorkspaceProps = {
  customers: CustomerRow[];
  canCreateCustomers: boolean;
  canUpdateCustomers: boolean;
  canDeleteCustomers: boolean;
  persistenceUserKey?: string | null;
};

type CustomerContactRow = {
  id: string;
  type: ContactDraft["type"];
  label: string | null;
  value: string;
  isPrimary: boolean;
  notes: string | null;
};

type CustomerCreateDraft = {
  customerType: "INDIVIDUAL" | "COMPANY";
  displayName: string;
  companyName: string;
  contactPersonName: string;
  contacts: ContactDraft[];
  source: string;
  notes: string;
};

type CustomerWorkspaceDraft = {
  createOpen: boolean;
  selectedCustomerId: string | null;
  createDraft: CustomerCreateDraft;
};

const initialState = {
  ok: false,
  message: ""
};

const emptyContact: ContactDraft = {
  type: "PHONE",
  label: "",
  value: "",
  isPrimary: true,
  notes: ""
};

const emptyCustomerCreateDraft: CustomerCreateDraft = {
  customerType: "INDIVIDUAL",
  displayName: "",
  companyName: "",
  contactPersonName: "",
  contacts: [emptyContact],
  source: "",
  notes: ""
};

const createCustomerEventName = "customers:new";

function sourceLabel(value: string | null) {
  return value ? value.replaceAll("_", " ").toLowerCase() : "None";
}

function typeDescription(customer: CustomerRow) {
  if (customer.customerType === "COMPANY") {
    if (customer.companyName && customer.contactPersonName) {
      return `${customer.companyName} - ${customer.contactPersonName}`;
    }

    return customer.companyName ?? "Company client";
  }

  return "Individual customer";
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().replace(/\D/g, "") || value.trim().toLowerCase();
}

function findPossibleMatches(customers: CustomerRow[], name: string, contacts: ContactDraft[]) {
  const nameQuery = name.trim().toLowerCase();
  const contactQueries = contacts
    .map((contact) => normalizeSearch(contact.value))
    .filter((value) => value.length >= 4);

  if (nameQuery.length < 3 && contactQueries.length === 0) {
    return [];
  }

  return customers
    .filter((customer) => {
      const names = [customer.displayName, customer.companyName ?? "", customer.contactPersonName ?? ""]
        .join(" ")
        .toLowerCase();
      const hasNameMatch = nameQuery.length >= 3 && names.includes(nameQuery);
      const hasContactMatch = customer.contactValues.some((value) => {
        const saved = normalizeSearch(value);
        return contactQueries.some((query) => saved.includes(query) || query.includes(saved));
      });

      return hasNameMatch || hasContactMatch;
    })
    .slice(0, 3);
}

export function CustomerCreateButton() {
  return (
    <Button
      type="button"
      onClick={() => window.dispatchEvent(new Event(createCustomerEventName))}
      className="w-fit"
    >
      <Plus className="h-4 w-4" />
      New customer
    </Button>
  );
}

function CustomerCreateDrawer({
  customers,
  draft,
  onDraftChange,
  onClose,
  onSaved,
  onUseExisting
}: {
  customers: CustomerRow[];
  draft: CustomerCreateDraft;
  onDraftChange: (patch: Partial<CustomerCreateDraft>) => void;
  onClose: () => void;
  onSaved: (message: string) => void;
  onUseExisting: (customer: CustomerRow) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createCustomerAction, initialState);
  const customerType = draft.customerType;
  const displayName = draft.displayName;
  const companyName = draft.companyName;
  const contacts = useMemo(
    () => (draft.contacts.length ? draft.contacts : [emptyContact]),
    [draft.contacts]
  );
  const possibleMatches = useMemo(
    () => findPossibleMatches(customers, displayName || companyName, contacts),
    [companyName, contacts, customers, displayName]
  );
  useBodyScrollLock(true);

  useEffect(() => {
    if (state.ok) {
      onSaved(state.message || "Customer saved.");
      router.refresh();
    }
  }, [onSaved, router, state.message, state.ok]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function updateContact(index: number, field: keyof ContactDraft, value: string | boolean) {
    onDraftChange({
      contacts: contacts.map((contact, contactIndex) => {
        if (contactIndex !== index) {
          return field === "isPrimary" && value === true
            ? { ...contact, isPrimary: false }
            : contact;
        }

        return {
          ...contact,
          [field]: value
        };
      })
    });
  }

  function addContact() {
    onDraftChange({
      contacts: [
        ...contacts,
        {
          ...emptyContact,
          isPrimary: contacts.length === 0
        }
      ]
    });
  }

  function removeContact(index: number) {
    const next = contacts.filter((_, contactIndex) => contactIndex !== index);
    onDraftChange({
      contacts: next.length ? next : [emptyContact]
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/35 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="studio-kicker">Buyer Records</p>
            <h2 className="text-base font-semibold">New customer</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} className="min-h-9 px-2" aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form id="customer-create-form" action={action} className="min-h-0 flex-1 overflow-y-auto p-5">
          <input type="hidden" name="contacts" value={JSON.stringify(contacts)} />
          <div className="grid gap-4">
            <label className="space-y-2 text-sm font-medium">
              Type
              <Select
                name="customerType"
                value={customerType}
                onChange={(event) =>
                  onDraftChange({ customerType: event.target.value as CustomerCreateDraft["customerType"] })
                }
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="COMPANY">Company</option>
              </Select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              Display name
              <Input
                name="displayName"
                value={displayName}
                onChange={(event) => onDraftChange({ displayName: event.target.value })}
                placeholder={customerType === "COMPANY" ? "Company display name" : "Customer name"}
              />
            </label>

            {customerType === "COMPANY" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Company name
                  <Input
                    name="companyName"
                    value={companyName}
                    onChange={(event) => onDraftChange({ companyName: event.target.value })}
                    placeholder="Company client"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Contact person
                  <Input
                    name="contactPersonName"
                    value={draft.contactPersonName}
                    onChange={(event) => onDraftChange({ contactPersonName: event.target.value })}
                    placeholder="Main contact"
                  />
                </label>
              </div>
            ) : (
              <>
                <input type="hidden" name="companyName" value="" />
                <input type="hidden" name="contactPersonName" value="" />
              </>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Primary contact</h3>
              {contacts.map((contact, index) => (
                <div
                  key={index}
                  className={cn(
                    "grid gap-2 rounded-lg border border-border bg-background p-3",
                    contacts.length > 1 ? "sm:grid-cols-[150px_1fr_auto]" : "sm:grid-cols-[150px_1fr]"
                  )}
                >
                  <Select
                    value={contact.type}
                    onChange={(event) => updateContact(index, "type", event.target.value)}
                    aria-label="Contact type"
                  >
                    <option value="PHONE">Phone</option>
                    <option value="VIBER">Viber</option>
                    <option value="FACEBOOK_PROFILE">Facebook profile</option>
                    <option value="FACEBOOK_PAGE">Facebook page</option>
                    <option value="EMAIL">Email</option>
                    <option value="OTHER">Other</option>
                  </Select>
                  <Input
                    value={contact.value}
                    onChange={(event) => updateContact(index, "value", event.target.value)}
                    placeholder="Number, profile name, or email"
                    aria-label="Contact value"
                  />
                  {contacts.length > 1 ? (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={contact.isPrimary}
                          onChange={(event) => updateContact(index, "isPrimary", event.target.checked)}
                          className="h-4 w-4 accent-[hsl(var(--primary))]"
                        />
                        Primary
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeContact(index)}
                        className="min-h-9 px-2"
                        aria-label="Remove contact"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addContact} className="min-h-9 px-3">
                <Plus className="h-4 w-4" />
                Add another contact
              </Button>
            </div>

            {possibleMatches.length ? (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                <p className="text-sm font-semibold">Possible existing customer</p>
                <div className="mt-2 space-y-2">
                  {possibleMatches.map((customer) => (
                    <div key={customer.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        {customer.displayName}
                        {customer.primaryContact ? (
                          <span className="text-muted-foreground"> - {customer.primaryContact}</span>
                        ) : null}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onUseExisting(customer)}
                        className="min-h-8 px-3 text-xs"
                      >
                        Use existing customer
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                Source
                <Select
                  name="source"
                  value={draft.source}
                  onChange={(event) => onDraftChange({ source: event.target.value })}
                >
                  <option value="">Optional</option>
                  <option value="FACEBOOK_MARKETPLACE">Facebook Marketplace</option>
                  <option value="FACEBOOK_PAGE">Facebook Page</option>
                  <option value="MESSENGER">Messenger</option>
                  <option value="VIBER">Viber</option>
                  <option value="WALK_IN">Walk-in</option>
                  <option value="PHONE">Phone</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="OTHER">Other</option>
                </Select>
              </label>
            </div>

            <label className="block space-y-2 text-sm font-medium">
              Notes
              <Textarea
                name="notes"
                value={draft.notes}
                onChange={(event) => onDraftChange({ notes: event.target.value })}
                placeholder="Optional buyer context."
              />
            </label>

            {state.message && !state.ok ? <p className="text-sm text-danger">{state.message}</p> : null}
          </div>
        </form>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="customer-create-form" disabled={pending}>
            <Save className="h-4 w-4" />
            Save customer
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomerDetailDrawer({
  customer,
  onClose
}: {
  customer: CustomerRow;
  onClose: () => void;
}) {
  useBodyScrollLock(true);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 bg-foreground/35 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="ml-auto flex h-full w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="studio-kicker">Customer</p>
            <h2 className="text-base font-semibold">{customer.displayName}</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} className="min-h-9 px-2" aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Type</p>
            <div className="mt-1">
              <StatusPill>{customer.customerType === "COMPANY" ? "Company client" : "Individual customer"}</StatusPill>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Primary contact</p>
            <p className="mt-1">{customer.primaryContact ?? "No contact saved"}</p>
          </div>
          {customer.contacts.length > 1 ? (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Contacts</p>
              <div className="mt-2 space-y-2">
                {customer.contacts.map((contact) => (
                  <p key={contact.id} className="rounded-md border border-border bg-background px-3 py-2">
                    <span className="font-medium capitalize">{sourceLabel(contact.type)}</span>
                    <span className="text-muted-foreground"> - {contact.value}</span>
                    {contact.isPrimary ? <span className="text-muted-foreground"> (primary)</span> : null}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          {customer.companyName || customer.contactPersonName ? (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Company details</p>
              <p className="mt-1">{customer.companyName ?? "No company name"}</p>
              {customer.contactPersonName ? (
                <p className="text-muted-foreground">{customer.contactPersonName}</p>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Source</p>
              <p className="mt-1 capitalize">{sourceLabel(customer.source)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Assigned staff</p>
              <p className="mt-1">{customer.assignedStaff ?? "Unassigned"}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Updated</p>
            <p className="mt-1">{customer.updatedAt}</p>
          </div>
          {customer.notes ? (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-wrap">{customer.notes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function customerEditDraft(customer: CustomerRow): CustomerCreateDraft {
  return {
    customerType: customer.customerType,
    displayName: customer.displayName,
    companyName: customer.companyName ?? "",
    contactPersonName: customer.contactPersonName ?? "",
    contacts: customer.contacts.length
      ? customer.contacts.map((contact) => ({
          type: contact.type,
          label: contact.label ?? "",
          value: contact.value,
          isPrimary: contact.isPrimary,
          notes: contact.notes ?? ""
        }))
      : [emptyContact],
    source: customer.source ?? "",
    notes: customer.notes ?? ""
  };
}

function CustomerEditDrawer({
  customer,
  onClose,
  onSaved
}: {
  customer: CustomerRow;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<CustomerCreateDraft>(() => customerEditDraft(customer));
  const [state, action, pending] = useActionState(updateCustomerAction, initialState);
  const contacts = draft.contacts.length ? draft.contacts : [emptyContact];
  useBodyScrollLock(true);

  useEffect(() => {
    setDraft(customerEditDraft(customer));
  }, [customer]);

  useEffect(() => {
    if (state.ok) {
      onSaved(state.message || "Customer updated.");
      router.refresh();
    }
  }, [onSaved, router, state.message, state.ok]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function updateDraft(patch: Partial<CustomerCreateDraft>) {
    setDraft((current) => ({
      ...current,
      ...patch
    }));
  }

  function updateContact(index: number, field: keyof ContactDraft, value: string | boolean) {
    updateDraft({
      contacts: contacts.map((contact, contactIndex) => {
        if (contactIndex !== index) {
          return field === "isPrimary" && value === true
            ? { ...contact, isPrimary: false }
            : contact;
        }

        return {
          ...contact,
          [field]: value
        };
      })
    });
  }

  function addContact() {
    updateDraft({
      contacts: [
        ...contacts,
        {
          ...emptyContact,
          isPrimary: contacts.length === 0
        }
      ]
    });
  }

  function removeContact(index: number) {
    const next = contacts.filter((_, contactIndex) => contactIndex !== index);
    updateDraft({
      contacts: next.length ? next : [emptyContact]
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/35 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="studio-kicker">Buyer Records</p>
            <h2 className="text-base font-semibold">Edit customer</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} className="min-h-9 px-2" aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form id="customer-edit-form" action={action} className="min-h-0 flex-1 overflow-y-auto p-5">
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="contacts" value={JSON.stringify(contacts)} />
          <div className="grid gap-4">
            <label className="space-y-2 text-sm font-medium">
              Type
              <Select
                name="customerType"
                value={draft.customerType}
                onChange={(event) =>
                  updateDraft({ customerType: event.target.value as CustomerCreateDraft["customerType"] })
                }
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="COMPANY">Company</option>
              </Select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              Display name
              <Input
                name="displayName"
                value={draft.displayName}
                onChange={(event) => updateDraft({ displayName: event.target.value })}
                placeholder={draft.customerType === "COMPANY" ? "Company display name" : "Customer name"}
              />
            </label>

            {draft.customerType === "COMPANY" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Company name
                  <Input
                    name="companyName"
                    value={draft.companyName}
                    onChange={(event) => updateDraft({ companyName: event.target.value })}
                    placeholder="Company client"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Contact person
                  <Input
                    name="contactPersonName"
                    value={draft.contactPersonName}
                    onChange={(event) => updateDraft({ contactPersonName: event.target.value })}
                    placeholder="Main contact"
                  />
                </label>
              </div>
            ) : (
              <>
                <input type="hidden" name="companyName" value="" />
                <input type="hidden" name="contactPersonName" value="" />
              </>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Contacts</h3>
              {contacts.map((contact, index) => (
                <div
                  key={index}
                  className={cn(
                    "grid gap-2 rounded-lg border border-border bg-background p-3",
                    contacts.length > 1 ? "sm:grid-cols-[150px_1fr_auto]" : "sm:grid-cols-[150px_1fr]"
                  )}
                >
                  <Select
                    value={contact.type}
                    onChange={(event) => updateContact(index, "type", event.target.value)}
                    aria-label="Contact type"
                  >
                    <option value="PHONE">Phone</option>
                    <option value="VIBER">Viber</option>
                    <option value="FACEBOOK_PROFILE">Facebook profile</option>
                    <option value="FACEBOOK_PAGE">Facebook page</option>
                    <option value="EMAIL">Email</option>
                    <option value="OTHER">Other</option>
                  </Select>
                  <Input
                    value={contact.value}
                    onChange={(event) => updateContact(index, "value", event.target.value)}
                    placeholder="Number, profile name, or email"
                    aria-label="Contact value"
                  />
                  {contacts.length > 1 ? (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={contact.isPrimary}
                          onChange={(event) => updateContact(index, "isPrimary", event.target.checked)}
                          className="h-4 w-4 accent-[hsl(var(--primary))]"
                        />
                        Primary
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeContact(index)}
                        className="min-h-9 px-2"
                        aria-label="Remove contact"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addContact} className="min-h-9 px-3">
                <Plus className="h-4 w-4" />
                Add another contact
              </Button>
            </div>

            <label className="space-y-2 text-sm font-medium">
              Source
              <Select
                name="source"
                value={draft.source}
                onChange={(event) => updateDraft({ source: event.target.value })}
              >
                <option value="">Optional</option>
                <option value="FACEBOOK_MARKETPLACE">Facebook Marketplace</option>
                <option value="FACEBOOK_PAGE">Facebook Page</option>
                <option value="MESSENGER">Messenger</option>
                <option value="VIBER">Viber</option>
                <option value="WALK_IN">Walk-in</option>
                <option value="PHONE">Phone</option>
                <option value="REFERRAL">Referral</option>
                <option value="OTHER">Other</option>
              </Select>
            </label>

            <label className="block space-y-2 text-sm font-medium">
              Notes
              <Textarea
                name="notes"
                value={draft.notes}
                onChange={(event) => updateDraft({ notes: event.target.value })}
                placeholder="Optional buyer context."
              />
            </label>

            {state.message && !state.ok ? <p className="text-sm text-danger">{state.message}</p> : null}
          </div>
        </form>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="customer-edit-form" disabled={pending}>
            <Save className="h-4 w-4" />
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomerDeleteDialog({
  customer,
  onClose,
  onDeleted
}: {
  customer: CustomerRow;
  onClose: () => void;
  onDeleted: (message: string) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteCustomerAction, initialState);
  useBodyScrollLock(true);

  useEffect(() => {
    if (state.ok) {
      onDeleted(state.message || "Customer deleted.");
      router.refresh();
    }
  }, [onDeleted, router, state.message, state.ok]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-panel shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="studio-kicker">Customer Directory</p>
            <h2 className="text-base font-semibold">Delete customer</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} className="min-h-9 px-2" aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3 p-5 text-sm">
          <p>
            Delete <span className="font-semibold">{customer.displayName}</span> from the active customer
            directory?
          </p>
          <p className="text-muted-foreground">
            The customer will be removed from active lists, but quotation, order, payment, and delivery history remains
            intact.
          </p>
          {state.message && !state.ok ? <p className="text-danger">{state.message}</p> : null}
        </div>
        <form action={action} className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
          <input type="hidden" name="customerId" value={customer.id} />
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={pending}>
            <Trash2 className="h-4 w-4" />
            Delete customer
          </Button>
        </form>
      </div>
    </div>
  );
}

export function CustomerWorkspace({
  customers,
  canCreateCustomers,
  canUpdateCustomers,
  canDeleteCustomers,
  persistenceUserKey
}: CustomerWorkspaceProps) {
  const initialWorkspaceDraft: CustomerWorkspaceDraft = {
    createOpen: false,
    selectedCustomerId: null,
    createDraft: emptyCustomerCreateDraft
  };
  const [workspaceDraft, setWorkspaceDraft, workspacePersistence] =
    usePersistentPageState<CustomerWorkspaceDraft>({
      scope: "customers",
      userKey: persistenceUserKey,
      version: 1,
      initialState: initialWorkspaceDraft
    });
  const hasAppliedWorkspaceDraft = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerRow | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!workspacePersistence.restored || hasAppliedWorkspaceDraft.current) {
      return;
    }

    hasAppliedWorkspaceDraft.current = true;
    setCreateOpen(Boolean(workspaceDraft.createOpen && canCreateCustomers));
    setSelectedCustomer(
      customers.find((customer) => customer.id === workspaceDraft.selectedCustomerId) ?? null
    );
  }, [
    canCreateCustomers,
    customers,
    workspaceDraft.createOpen,
    workspaceDraft.selectedCustomerId,
    workspacePersistence.restored
  ]);

  useEffect(() => {
    if (!workspacePersistence.restored || !hasAppliedWorkspaceDraft.current) {
      return;
    }

    setWorkspaceDraft((current) => ({
      ...current,
      createOpen,
      selectedCustomerId: selectedCustomer?.id ?? null
    }));
  }, [
    createOpen,
    selectedCustomer?.id,
    setWorkspaceDraft,
    workspacePersistence.restored
  ]);

  useEffect(() => {
    function openCreateDrawer() {
      setSuccessMessage("");
      setSelectedCustomer(null);
      setEditingCustomer(null);
      setDeletingCustomer(null);
      setCreateOpen(true);
      setWorkspaceDraft((current) => ({
        ...current,
        createOpen: true,
        selectedCustomerId: null
      }));
    }

    window.addEventListener(createCustomerEventName, openCreateDrawer);
    return () => window.removeEventListener(createCustomerEventName, openCreateDrawer);
  }, [setWorkspaceDraft]);

  useEffect(() => {
    if (selectedCustomer && !customers.some((customer) => customer.id === selectedCustomer.id)) {
      setSelectedCustomer(null);
    }

    if (editingCustomer && !customers.some((customer) => customer.id === editingCustomer.id)) {
      setEditingCustomer(null);
    }

    if (deletingCustomer && !customers.some((customer) => customer.id === deletingCustomer.id)) {
      setDeletingCustomer(null);
    }
  }, [customers, deletingCustomer, editingCustomer, selectedCustomer]);

  function openCustomer(customer: CustomerRow) {
    setCreateOpen(false);
    setEditingCustomer(null);
    setDeletingCustomer(null);
    setSelectedCustomer(customer);
    setWorkspaceDraft((current) => ({
      ...current,
      selectedCustomerId: customer.id
    }));
  }

  function editCustomer(customer: CustomerRow) {
    setSuccessMessage("");
    setCreateOpen(false);
    setSelectedCustomer(null);
    setDeletingCustomer(null);
    setEditingCustomer(customer);
  }

  function deleteCustomer(customer: CustomerRow) {
    setSuccessMessage("");
    setCreateOpen(false);
    setEditingCustomer(null);
    setDeletingCustomer(customer);
  }

  function updateCreateDraft(patch: Partial<CustomerCreateDraft>) {
    setWorkspaceDraft((current) => ({
      ...current,
      createDraft: {
        ...current.createDraft,
        ...patch
      }
    }));
  }

  function closeCreateDrawer() {
    setCreateOpen(false);
    setWorkspaceDraft((current) => ({
      ...current,
      createOpen: false,
      createDraft: emptyCustomerCreateDraft
    }));
  }

  return (
    <>
      {successMessage ? (
        <div className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {successMessage}
        </div>
      ) : null}

      <section className="studio-card">
        <div className="overflow-x-auto">
          <table className="studio-table w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Primary contact</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Assigned staff</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openCustomer(customer)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openCustomer(customer);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{customer.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{typeDescription(customer)}</p>
                      </div>
                      <StatusPill>{customer.customerType === "COMPANY" ? "Company" : "Individual"}</StatusPill>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {customer.primaryContact ?? "No contact saved"}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{sourceLabel(customer.source)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.assignedStaff ?? "Unassigned"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.updatedAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          openCustomer(customer);
                        }}
                        className="min-h-8 px-3 text-xs"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      {canUpdateCustomers ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            editCustomer(customer);
                          }}
                          className="min-h-8 px-3 text-xs"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      ) : null}
                      {canDeleteCustomers ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteCustomer(customer);
                          }}
                          className="min-h-8 px-3 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-muted-foreground" colSpan={6}>
                    <div className="studio-empty px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        No customers match the current filters.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canCreateCustomers && createOpen ? (
        <CustomerCreateDrawer
          customers={customers}
          draft={workspaceDraft.createDraft ?? emptyCustomerCreateDraft}
          onDraftChange={updateCreateDraft}
          onClose={closeCreateDrawer}
          onSaved={(message) => {
            setCreateOpen(false);
            setSuccessMessage(message);
            setWorkspaceDraft((current) => ({
              ...current,
              createOpen: false,
              createDraft: emptyCustomerCreateDraft
            }));
          }}
          onUseExisting={(customer) => {
            setCreateOpen(false);
            setSelectedCustomer(customer);
            setWorkspaceDraft((current) => ({
              ...current,
              createOpen: false,
              selectedCustomerId: customer.id,
              createDraft: emptyCustomerCreateDraft
            }));
          }}
        />
      ) : null}

      {selectedCustomer ? (
        <CustomerDetailDrawer
          customer={selectedCustomer}
          onClose={() => {
            setSelectedCustomer(null);
            setWorkspaceDraft((current) => ({
              ...current,
              selectedCustomerId: null
            }));
          }}
        />
      ) : null}

      {canUpdateCustomers && editingCustomer ? (
        <CustomerEditDrawer
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={(message) => {
            setEditingCustomer(null);
            setSuccessMessage(message);
          }}
        />
      ) : null}

      {canDeleteCustomers && deletingCustomer ? (
        <CustomerDeleteDialog
          customer={deletingCustomer}
          onClose={() => setDeletingCustomer(null)}
          onDeleted={(message) => {
            const deletedCustomerId = deletingCustomer.id;
            setDeletingCustomer(null);
            setEditingCustomer((current) => (current?.id === deletedCustomerId ? null : current));
            setSelectedCustomer((current) => (current?.id === deletedCustomerId ? null : current));
            setSuccessMessage(message);
          }}
        />
      ) : null}
    </>
  );
}
