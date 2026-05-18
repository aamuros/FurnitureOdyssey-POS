import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function SalesHistoryPage() {
  return (
    <ModulePlaceholder
      module="SALES_HISTORY"
      title="Sales History"
      description="Permission-controlled sales tracking area for historical operational records."
      focus={["Completed orders", "Payment status", "Delivery status", "Financial visibility controls"]}
    />
  );
}
