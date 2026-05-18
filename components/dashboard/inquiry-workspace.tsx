"use client";

import { useActionState } from "react";
import { ClipboardPlus } from "lucide-react";
import { createInquiryAction } from "@/app/actions/customer-inquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";

type StaffOption = {
  id: string;
  displayName: string;
};

type CustomerOption = {
  id: string;
  displayName: string;
  companyName: string | null;
};

type InquiryRow = {
  id: string;
  subject: string;
  customerName: string;
  source: string;
  status: string;
  priority: string;
  requestedItems: string | null;
  assignedStaff: string | null;
  followUpAt: string | null;
  createdAt: string;
};

type InquiryWorkspaceProps = {
  inquiries: InquiryRow[];
  customers: CustomerOption[];
  staff: StaffOption[];
};

const initialState = {
  ok: false,
  message: ""
};

function readable(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function statusTone(status: string) {
  if (status === "CONVERTED_TO_ORDER" || status === "QUOTED") {
    return "success" as const;
  }

  if (status === "LOST" || status === "CLOSED") {
    return "danger" as const;
  }

  if (status === "WAITING_FOR_CUSTOMER") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function priorityTone(priority: string) {
  if (priority === "HIGH") {
    return "danger" as const;
  }

  if (priority === "LOW") {
    return "neutral" as const;
  }

  return "warning" as const;
}

export function InquiryWorkspace({ inquiries, customers, staff }: InquiryWorkspaceProps) {
  const [state, action, pending] = useActionState(createInquiryAction, initialState);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-lg border border-border bg-panel">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">New inquiry</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manually capture Facebook, Messenger, and Viber requests.
          </p>
        </div>
        <form action={action} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              Customer
              <Select name="customerId" required defaultValue="">
                <option value="" disabled>
                  Choose a customer
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName}
                    {customer.companyName ? ` - ${customer.companyName}` : ""}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Source
              <Select name="source" defaultValue="FACEBOOK_MARKETPLACE">
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
            <label className="space-y-2 text-sm font-medium">
              Source reference
              <Input name="sourceReference" placeholder="Profile name, listing, or Viber note" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Status
              <Select name="status" defaultValue="NEW">
                <option value="NEW">New</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="WAITING_FOR_CUSTOMER">Waiting for customer</option>
                <option value="QUOTED">Quoted</option>
                <option value="CONVERTED_TO_ORDER">Converted to order</option>
                <option value="CLOSED">Closed</option>
                <option value="LOST">Lost</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Priority
              <Select name="priority" defaultValue="NORMAL">
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              Subject
              <Input name="subject" required placeholder="Dining set inquiry, office chairs, custom sofa" />
            </label>
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              Requested items
              <Textarea name="requestedItems" placeholder="Furniture, dimensions, colors, quantity, or custom requirements." />
            </label>
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              Message summary
              <Textarea name="messageSummary" placeholder="Short manual summary of the conversation." />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Budget range
              <Input name="budgetRange" placeholder="Optional" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Delivery location
              <Input name="deliveryLocation" placeholder="City, province, building, or landmark" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Target delivery
              <Input name="targetDeliveryDate" type="date" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Follow-up
              <Input name="followUpAt" type="date" />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Last contacted
              <Input name="lastContactedAt" type="date" />
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
          </div>
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-danger"}>
              {state.message}
            </p>
          ) : null}
          <Button disabled={pending || customers.length === 0}>
            <ClipboardPlus className="h-4 w-4" />
            Save inquiry
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-panel">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Inquiry records</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current manual intake records linked to customers.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Inquiry</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Assigned</th>
                <th className="px-5 py-3 font-medium">Follow-up</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inquiries.map((inquiry) => (
                <tr key={inquiry.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{inquiry.subject}</p>
                    <p className="max-w-xs truncate text-xs text-muted-foreground">
                      {inquiry.requestedItems ?? "No requested items recorded"}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{inquiry.customerName}</td>
                  <td className="px-5 py-3 capitalize text-muted-foreground">
                    {readable(inquiry.source)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <StatusPill tone={statusTone(inquiry.status)}>{inquiry.status}</StatusPill>
                      <StatusPill tone={priorityTone(inquiry.priority)}>{inquiry.priority}</StatusPill>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {inquiry.assignedStaff ?? "Unassigned"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {inquiry.followUpAt ?? "None"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{inquiry.createdAt}</td>
                </tr>
              ))}
              {inquiries.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-muted-foreground" colSpan={7}>
                    No inquiries match the current filters.
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
