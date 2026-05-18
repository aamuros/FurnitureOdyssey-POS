import { PageHeader } from "@/components/dashboard/page-header";
import { UserManagement } from "@/components/dashboard/user-management";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/server";

export default async function UsersPage() {
  await requireAdmin();
  const users = await prisma.userProfile.findMany({
    orderBy: [
      {
        role: "asc"
      },
      {
        displayName: "asc"
      }
    ],
    include: {
      permissions: {
        select: {
          module: true,
          action: true,
          allowed: true
        }
      }
    }
  });

  return (
    <>
      <PageHeader
        title="Users"
        description="Admin-only control for invited accounts, role assignment, activation, and Staff permissions."
      />
      <UserManagement
        users={users.map((user) => ({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          status: user.status,
          permissions: user.permissions
        }))}
      />
    </>
  );
}
