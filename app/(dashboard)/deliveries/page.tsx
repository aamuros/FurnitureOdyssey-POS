import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function DeliveriesPage() {
  return (
    <ModulePlaceholder
      module="DELIVERIES"
      title="Deliveries"
      description="Delivery scheduling foundation for partial deliveries and multiple delivery records per order."
      focus={["Delivery schedule", "Partial delivery", "Delivery receipt", "Completion status"]}
    />
  );
}
