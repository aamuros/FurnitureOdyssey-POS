"use client";

import { useActionState, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { createCustomerAction } from "@/app/actions/customer-inquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";

type StaffOption = {
  id: string;
  displayName: string;
};

type CustomerRow = {
  id: string;
  displayName: string;
  customerType: "INDIVIDUAL" | "COMPANY";
  companyName: string | null;
  contactPersonName: string | null;
  primaryContact: string | null;
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
  staff: StaffOption[];
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

function sourceLabel(value: string | null) {
  return value ? value.replaceAll("_", " ").toLowerCase() : "None";
}

export function CustomerWorkspace({ customers, staff }: CustomerWorkspaceProps) {
  const [state, action, pending] = useActionState(createCustomerAction, initialState);
  const [contacts, setContacts] = useState<ContactDraft[]>([emptyContact]);

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
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="studio-card">
        <div className="studio-card-header">
          <p className="studio-kicker">Buyer Records</p>
          <h2 className="text-sm font-semibold">New customer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer records help reuse contact details and view sales history.
          </p>
        </div>
        <form action={action} className="space-y-4 p-5">
          <input type="hidden" name="contacts" value={JSON.stringify(contacts)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Type
              <Select name="customerType" defaultValue="INDIVIDUAL">
                <option value="INDIVIDUAL">Individual</option>
                <option value="COMPANY">Company</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Assigned staff
              <Select name="assignedStaffId" defaultValue="">
                <option value="">Unassigned</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </Select>
            </label>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Display name
              <Input name="displayName" placeholder="Juan Dela Cruz" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Company name
              <Input name="companyName" placeholder="Company client name" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              First name
              <Input name="firstName" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Last name
              <Input name="lastName" />
            </label>
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              Contact person
              <Input name="contactPersonName" placeholder="For company clients" />
            </label>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Contact methods</h3>
              <Button type="button" variant="secondary" onClick={addContact} className="min-h-9 px-3">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            {contacts.map((contact, index) => (
              <div key={index} className="studio-subpanel grid gap-3 p-3 sm:grid-cols-[0.9fr_1.2fr_auto]">
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
                  <Button type="button" variant="ghost" onClick={() => removeContact(index)} className="min-h-9 px-2">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <label className="block space-y-2 text-sm font-medium">
            Notes
            <Textarea name="notes" placeholder="Optional buyer context from Facebook, Messenger, Viber, phone, walk-in, or staff handoff." />
          </label>
          {state.message ? (
            <p className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>
              {state.message}
            </p>
          ) : null}
          <Button disabled={pending}>
            <Save className="h-4 w-4" />
            Save customer
          </Button>
        </form>
      </section>

      <section className="studio-card">
        <div className="studio-card-header">
          <p className="studio-kicker">Customer Directory</p>
          <h2 className="text-sm font-semibold">Buyer records</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search and filter from the page controls above this list.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="studio-table w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Primary contact</th>
                <th className="px-5 py-3 font-medium">Assigned</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{customer.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {customer.contactPersonName ?? customer.companyName ?? "Individual customer"}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill>{customer.customerType}</StatusPill>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {customer.primaryContact ?? "No contact saved"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {customer.assignedStaff ?? "Unassigned"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="capitalize text-muted-foreground">{sourceLabel(customer.source)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{customer.updatedAt}</td>
                </tr>
              ))}
              {customers.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-sm text-muted-foreground" colSpan={6}>
                    <div className="studio-empty px-4 py-4">No customers match the current filters.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
