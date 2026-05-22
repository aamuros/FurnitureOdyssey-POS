import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsWorkspace } from "@/components/dashboard/settings-workspace";
import { requirePermission } from "@/lib/auth/server";
import { hasPermission, type UserWithPermissions } from "@/lib/auth/permissions";
import { getAppSettings } from "@/lib/settings/get-settings";

export default async function SettingsPage() {
  const user = (await requirePermission("SETTINGS", "VIEW")) as UserWithPermissions;
  const settings = await getAppSettings();
  const canUpdate = hasPermission(user, "SETTINGS", "UPDATE");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Admin configuration for company details, payment instructions, document labels, and PDF defaults."
      />
      <SettingsWorkspace settings={settings} canUpdate={canUpdate} persistenceUserKey={user.id} />
    </>
  );
}
