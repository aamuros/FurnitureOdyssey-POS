import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function PaymentsPage() {
  return (
    <ModulePlaceholder
      module="PAYMENTS"
      title="Payments"
      description="Payment tracking foundation for partial payments and multiple payment records per order."
      focus={["Payment entries", "Partial payments", "Reference numbers", "Sensitive totals"]}
    />
  );
}
