import type { PermissionModule } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { requirePermission } from "@/lib/auth/server";

type ModulePlaceholderProps = {
  module: PermissionModule;
  title: string;
  description: string;
  focus: string[];
};

export async function ModulePlaceholder({
  module,
  title,
  description,
  focus
}: ModulePlaceholderProps) {
  await requirePermission(module, "VIEW");

  return (
    <>
      <PageHeader title={title} description={description} />
      <section className="rounded-lg border border-border bg-panel">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Phase 1 placeholder</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Access control and navigation are active. Full records will be added in later phases.
          </p>
        </div>
        <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
          {focus.map((item) => (
            <div key={item} className="border-b border-border px-5 py-4 last:border-b-0 sm:border-r lg:last:border-r-0">
              <p className="text-sm font-medium">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
