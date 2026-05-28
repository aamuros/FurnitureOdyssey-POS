import { PageHeader } from "@/components/dashboard/page-header";
import {
  CatalogueContentWorkspace,
  type CatalogueContentRow
} from "@/components/dashboard/catalogue-content-workspace";
import { requirePermission } from "@/lib/auth/server";
import { hasPermission, type UserWithPermissions } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function CataloguePage() {
  const user = (await requirePermission("CATALOGUE", "VIEW")) as UserWithPermissions;
  const canUpdate = hasPermission(user, "CATALOGUE", "UPDATE");
  const canUpload = hasPermission(user, "CATALOGUE", "UPLOAD");
  const canReset = hasPermission(user, "CATALOGUE", "RESET");
  const rows = await prisma.pageContent.findMany({
    orderBy: [
      { page: "asc" },
      { section: "asc" },
      { fieldKey: "asc" }
    ]
  });

  const serializedRows: CatalogueContentRow[] = rows.map((row) => ({
    id: row.id,
    page: row.page,
    section: row.section,
    fieldKey: row.fieldKey,
    fieldValue: row.fieldValue,
    updatedAt: row.updatedAt.toISOString()
  }));

  return (
    <>
      <PageHeader
        eyebrow="CATALOGUE"
        title="Catalogue Content"
        description="Manage public catalogue page text, headings, and section copy."
      />
      <CatalogueContentWorkspace
        rows={serializedRows}
        canUpdate={canUpdate}
        canUpload={canUpload}
        canReset={canReset}
      />
    </>
  );
}
