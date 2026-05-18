import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function DocumentsPage() {
  return (
    <ModulePlaceholder
      module="DOCUMENTS"
      title="Documents"
      description="Document and PDF area for quotations, invoices, receipts, and delivery receipts."
      focus={["Generated PDFs", "Cloudinary metadata", "Document exports", "Record links"]}
    />
  );
}
