"use client";

import { useActionState, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { createCustomerAction } from "@/app/actions/customer-inquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type StaffOption = {
  id: string;
  displayName: string;
};

type ContactDraft = {
  type: "PHONE" | "VIBER" | "FACEBOOK_PROFILE" | "FACEBOOK_PAGE" | "EMAIL" | "OTHER";
  value: string;
  isPrimary: boolean;
};

type QuickCustomerFormProps = {
  staff?: StaffOption[];
  title?: string;
  description?: string;
};

const initialState = {
  ok: false,
  message: ""
};

const emptyContact: ContactDraft = {
  type: "PHONE",
  value: "",
  isPrimary: true
};

export function QuickCustomerForm({
  staff = [],
  title = "Add buyer record",
  description = "Select an existing customer or add a new one when a buyer is ready for a quotation or order."
}: QuickCustomerFormProps) {
  const [state, action, pending] = useActionState(createCustomerAction, initialState);
  const [contacts, setContacts] = useState<ContactDraft[]>([emptyContact]);

  function updateContact(index: number, field: keyof ContactDraft, value: string | boolean) {
    setContacts((current) =>
      current.map((contact, contactIndex) => {
        if (contactIndex !== index) {
          return field === "isPrimary" && value === true ? { ...contact, isPrimary: false } : contact;
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
    <section className="studio-card">
      <div className="studio-card-header">
        <p className="studio-kicker">Buyer Records</p>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <form action={action} className="grid gap-3 p-5 md:grid-cols-4">
        <input type="hidden" name="contacts" value={JSON.stringify(contacts)} />
        <Select name="customerType" defaultValue="INDIVIDUAL" aria-label="Customer type">
          <option value="INDIVIDUAL">Individual</option>
          <option value="COMPANY">Company</option>
        </Select>
        <Input name="displayName" placeholder="Buyer name" />
        <Input name="companyName" placeholder="Company name" />
        <Input name="contactPersonName" placeholder="Contact person" />
        <Select name="source" defaultValue="" aria-label="Customer source">
          <option value="">Source optional</option>
          <option value="FACEBOOK_MARKETPLACE">Facebook Marketplace</option>
          <option value="FACEBOOK_PAGE">Facebook Page</option>
          <option value="MESSENGER">Messenger</option>
          <option value="VIBER">Viber</option>
          <option value="WALK_IN">Walk-in</option>
          <option value="PHONE">Phone</option>
          <option value="REFERRAL">Referral</option>
          <option value="OTHER">Other</option>
        </Select>
        <Select name="assignedStaffId" defaultValue="" aria-label="Assigned staff">
          <option value="">Unassigned</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </Select>
        <Textarea
          name="notes"
          placeholder="Customer records help reuse contact details and view sales history."
          className="md:col-span-2"
        />
        <div className="space-y-2 md:col-span-4">
          {contacts.map((contact, index) => (
            <div key={index} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[180px_1fr_auto]">
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
                  />
                  Primary
                </label>
                <Button type="button" variant="ghost" onClick={() => removeContact(index)} className="min-h-9 px-2">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addContact} className="min-h-9 px-3">
            <Plus className="h-4 w-4" />
            Add contact
          </Button>
        </div>
        {state.message ? (
          <p className={state.ok ? "text-sm text-success md:col-span-4" : "text-sm text-danger md:col-span-4"}>
            {state.message}
          </p>
        ) : null}
        <Button disabled={pending} className="md:col-span-4">
          <Save className="h-4 w-4" />
          Save customer
        </Button>
      </form>
    </section>
  );
}
