"use server";

import { revalidatePath } from "next/cache";
import type {
  ActivityAction,
  PermissionAction,
  PermissionModule,
  UserRole,
  UserStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inviteUserSchema, updateUserSchema } from "@/lib/validation/users";

type ActionState = {
  ok: boolean;
  message: string;
};

function normalizePermissions(
  permissions: Array<{
    module: PermissionModule;
    action: PermissionAction;
    allowed: boolean;
  }>
) {
  return permissions.map((permission) => ({
    module: permission.module,
    action: permission.action,
    allowed: permission.allowed
  }));
}

function parsePermissions(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function permissionSignature(
  permissions: Array<{
    module: PermissionModule;
    action: PermissionAction;
    allowed: boolean;
  }>
) {
  return permissions
    .map((permission) => `${permission.module}:${permission.action}:${permission.allowed}`)
    .sort()
    .join("|");
}

export async function inviteUserAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    role: formData.get("role"),
    permissions: parsePermissions(formData.get("permissions"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid user details."
    };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      display_name: parsed.data.displayName
    }
  });

  if (error || !data.user) {
    return {
      ok: false,
      message: error?.message ?? "Unable to invite user."
    };
  }

  await prisma.$transaction(async (tx) => {
    const profile = await tx.userProfile.create({
      data: {
        authUserId: data.user.id,
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        role: parsed.data.role as UserRole,
        status: "PENDING",
        invitedById: actor.id,
        invitedAt: new Date(),
        permissions: {
          createMany: {
            data: normalizePermissions(parsed.data.permissions)
          }
        }
      }
    });

    await tx.activityLog.create({
      data: {
        action: "USER_INVITED",
        actorId: actor.id,
        targetUserId: profile.id,
        summary: `Invited ${profile.email} as ${profile.role}.`
      }
    });
  });

  revalidatePath("/users");
  return {
    ok: true,
    message: "User invitation sent."
  };
}

export async function updateUserAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    displayName: formData.get("displayName"),
    role: formData.get("role"),
    status: formData.get("status"),
    permissions: parsePermissions(formData.get("permissions"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid user details."
    };
  }

  const activeAdminCount = await prisma.userProfile.count({
    where: {
      role: "ADMIN",
      status: "ACTIVE"
    }
  });

  const existing = await prisma.userProfile.findUnique({
    where: {
      id: parsed.data.userId
    },
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

  if (!existing) {
    return {
      ok: false,
      message: "User profile was not found."
    };
  }

  const wouldRemoveLastAdmin =
    existing.role === "ADMIN" &&
    existing.status === "ACTIVE" &&
    (parsed.data.role !== "ADMIN" || parsed.data.status !== "ACTIVE") &&
    activeAdminCount <= 1;

  if (wouldRemoveLastAdmin) {
    return {
      ok: false,
      message: "At least one active Admin must remain."
    };
  }

  const permissionChanges =
    permissionSignature(existing.permissions) !== permissionSignature(parsed.data.permissions);
  const roleChanged = existing.role !== parsed.data.role;
  const statusChanged = existing.status !== parsed.data.status;

  await prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({
      where: {
        userId: parsed.data.userId
      }
    });

    await tx.userProfile.update({
      where: {
        id: parsed.data.userId
      },
      data: {
        displayName: parsed.data.displayName,
        role: parsed.data.role as UserRole,
        status: parsed.data.status as UserStatus,
        permissions: {
          createMany: {
            data: normalizePermissions(parsed.data.permissions)
          }
        }
      }
    });

    const activityLogs: Array<{
      action: ActivityAction;
      actorId: string;
      targetUserId: string;
      summary: string;
      metadata?: Record<string, string>;
    }> = [
      {
        action: "USER_UPDATED",
        actorId: actor.id,
        targetUserId: parsed.data.userId,
        summary: `Updated user access for ${existing.email}.`,
        metadata: {
          role: parsed.data.role,
          status: parsed.data.status
        }
      }
    ];

    if (roleChanged) {
      activityLogs.push({
        action: "ROLE_CHANGED",
        actorId: actor.id,
        targetUserId: parsed.data.userId,
        summary: `Changed ${existing.email} from ${existing.role} to ${parsed.data.role}.`,
        metadata: {
          previousRole: existing.role,
          nextRole: parsed.data.role
        }
      });
    }

    if (permissionChanges) {
      activityLogs.push({
        action: "PERMISSIONS_CHANGED",
        actorId: actor.id,
        targetUserId: parsed.data.userId,
        summary: `Updated Staff permissions for ${existing.email}.`
      });
    }

    if (statusChanged && parsed.data.status === "ACTIVE") {
      activityLogs.push({
        action: "USER_ACTIVATED",
        actorId: actor.id,
        targetUserId: parsed.data.userId,
        summary: `Activated ${existing.email}.`,
        metadata: {
          previousStatus: existing.status,
          nextStatus: parsed.data.status
        }
      });
    }

    if (statusChanged && parsed.data.status === "INACTIVE") {
      activityLogs.push({
        action: "USER_DEACTIVATED",
        actorId: actor.id,
        targetUserId: parsed.data.userId,
        summary: `Deactivated ${existing.email}.`,
        metadata: {
          previousStatus: existing.status,
          nextStatus: parsed.data.status
        }
      });
    }

    await tx.activityLog.createMany({
      data: activityLogs
    });
  });

  revalidatePath("/users");
  return {
    ok: true,
    message: "User profile updated."
  };
}
