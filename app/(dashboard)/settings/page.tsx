import { PageHeader } from "@/components/dashboard/page-header";
import { requireAdmin } from "@/lib/auth/server";

export default async function SettingsPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Admin-only foundation for future business settings, document defaults, and system configuration."
      />
      <section className="rounded-lg border border-border bg-panel p-5">
        <h2 className="text-sm font-semibold">Phase 1 placeholder</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Settings are protected for Admin users. Detailed configuration will be added as operational modules mature.
        </p>
      </section>
    </>
  );
}
