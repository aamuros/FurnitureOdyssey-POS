"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Eye, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createCustomerAction } from "@/app/actions/customer-inquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CustomerRow = {
  id: string;
  displayName: string;
  customerType: "INDIVIDUAL" | "COMPANY";
  companyName: string | null;
  contactPersonName: string | null;
  primaryContact: string | null;
  contactValues: string[];
  source: string | null;
  assignedStaff: string | null;
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
  onClose,
  onSaved,
  onUseExisting
}: {
  customers: CustomerRow[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onUseExisting: (customer: CustomerRow) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createCustomerAction, initialState);
  const [customerType, setCustomerType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contacts, setContacts] = useState<ContactDraft[]>([emptyContact]);
  const possibleMatches = useMemo(
    () => findPossibleMatches(customers, displayName || companyName, contacts),
    [companyName, contacts, customers, displayName]
  );

  useEffect(() => {
    if (state.ok) {
      onSaved(state.message || "Customer saved.");
      router.refresh();
    }
  }, [onSaved, router, state.message, state.ok]);

  function updateContact(index: number, field: keyof ContactDraft, value: string | boolean) {
    setContacts((current) =>
      current.map((contact, contactIndex) => {
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
    );
  }

  function addContact() {
    setContacts((current) => [
      ...current,
      {
        ...emptyContact,
        isPrimary: current.length === 0
      }
    ]);
  }

  function removeContact(index: number) {
    setContacts((current) => {
      const next = current.filter((_, contactIndex) => contactIndex !== index);
      return next.length ? next : [emptyContact];
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/35 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-xl">
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
                onChange={(event) => setCustomerType(event.target.value as "INDIVIDUAL" | "COMPANY")}
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
                onChange={(event) => setDisplayName(event.target.value)}
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
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Company client"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Contact person
                  <Input name="contactPersonName" placeholder="Main contact" />
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
                <Select name="source" defaultValue="">
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
              <Textarea name="notes" placeholder="Optional buyer context." />
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
        </div>
      </div>
    </div>
  );
}

export function CustomerWorkspace({ customers, canCreateCustomers }: CustomerWorkspaceProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    function openCreateDrawer() {
      setSuccessMessage("");
      setCreateOpen(true);
    }

    window.addEventListener(createCustomerEventName, openCreateDrawer);
    return () => window.removeEventListener(createCustomerEventName, openCreateDrawer);
  }, []);

  function openCustomer(customer: CustomerRow) {
    setSelectedCustomer(customer);
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
                    <div className="flex justify-end">
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
          onClose={() => setCreateOpen(false)}
          onSaved={(message) => {
            setCreateOpen(false);
            setSuccessMessage(message);
          }}
          onUseExisting={(customer) => {
            setCreateOpen(false);
            setSelectedCustomer(customer);
          }}
        />
      ) : null}

      {selectedCustomer ? (
        <CustomerDetailDrawer customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      ) : null}
    </>
  );
}
