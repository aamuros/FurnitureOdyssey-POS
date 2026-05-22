import { cache } from "react";
import { redirect } from "next/navigation";
import type { PermissionAction, PermissionModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission, type UserWithPermissions } from "@/lib/auth/permissions";

export const getCurrentAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

export const getCurrentUserProfile = cache(async () => {
  const authUser = await getCurrentAuthUser();

  if (!authUser) {
    return null;
  }

  return prisma.userProfile.findUnique({
    where: {
      authUserId: authUser.id
    },
    include: {
      permissions: true
    }
  });
});

export async function requireActiveUser() {
  const user = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "ACTIVE") {
    redirect("/login?error=inactive");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireActiveUser();

  if (user.role !== "ADMIN") {
    redirect("/dashboard?error=forbidden");
  }

  return user;
}

export async function requirePermission(
  module: PermissionModule,
  action: PermissionAction = "VIEW"
) {
  const user = (await requireActiveUser()) as UserWithPermissions;

  if (!hasPermission(user, module, action)) {
    redirect("/dashboard?error=forbidden");
  }

  return user;
}
