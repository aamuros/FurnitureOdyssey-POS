import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function OrdersPage() {
  return (
    <ModulePlaceholder
      module="ORDERS"
      title="Orders"
      description="Internal order records that do not require inventory availability to proceed in the MVP."
      focus={["Confirmed items", "Manual adjustments", "Order status", "Linked payments and deliveries"]}
    />
  );
}
