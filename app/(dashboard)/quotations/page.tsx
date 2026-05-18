import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function QuotationsPage() {
  return (
    <ModulePlaceholder
      module="QUOTATIONS"
      title="Quotations"
      description="Negotiated quotation records with manual price overrides and PDF export controls."
      focus={["Custom items", "Manual pricing", "Approval path", "Quotation PDF"]}
    />
  );
}
