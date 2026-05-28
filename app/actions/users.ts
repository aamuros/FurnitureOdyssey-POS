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
import { createUserSchema, updateUserSchema } from "@/lib/validation/users";

type ActionState = {
  ok: boolean;
  message: string;
  revision?: number;
  user?: {
    userId: string;
    role: UserRole;
    status: UserStatus;
    canLinkGoogleCalendar: boolean;
    permissions: Array<{
      module: PermissionModule;
      action: PermissionAction;
      allowed: boolean;
    }>;
  };
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

export async function createUserAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requireAdmin();
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    role: formData.get("role"),
    canLinkGoogleCalendar: formData.get("canLinkGoogleCalendar"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    permissions: parsePermissions(formData.get("permissions"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid user details."
    };
  }

  const existingProfile = await prisma.userProfile.findUnique({
    where: {
      email: parsed.data.email
    },
    select: {
      id: true
    }
  });

  if (existingProfile) {
    return {
      ok: false,
      message: "A user profile with this email already exists."
    };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      display_name: parsed.data.displayName
    }
  });

  if (error || !data.user) {
    const message = error?.message ?? "Unable to create user login account.";
    return {
      ok: false,
      message: /already|exists|registered/i.test(message)
        ? "A login account with this email already exists."
        : /password/i.test(message)
          ? "Temporary password is too weak or invalid."
          : message
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const profile = await tx.userProfile.create({
        data: {
          authUserId: data.user.id,
          email: parsed.data.email,
          displayName: parsed.data.displayName,
          role: parsed.data.role as UserRole,
          status: "ACTIVE",
          canLinkGoogleCalendar: parsed.data.canLinkGoogleCalendar,
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
          summary: `Created login account for ${profile.email} as ${profile.role}.`
        }
      });
    });
  } catch {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    return {
      ok: false,
      message: "User profile could not be saved. Please try again."
    };
  }

  revalidatePath("/users");
  return {
    ok: true,
    message: "User login account created."
  };
}

function isProtectedMainAdmin(user: { email: string; authUserId: string }) {
  const firstAdminEmail = process.env.FIRST_ADMIN_EMAIL?.trim().toLowerCase();
  const firstAdminAuthUserId = process.env.FIRST_ADMIN_AUTH_USER_ID?.trim();

  return Boolean(
    (firstAdminEmail && user.email.toLowerCase() === firstAdminEmail) ||
      (firstAdminAuthUserId && user.authUserId === firstAdminAuthUserId)
  );
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
    canLinkGoogleCalendar: formData.get("canLinkGoogleCalendar"),
    permissions: parsePermissions(formData.get("permissions"))
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid user details."
    };
  }

  const [activeAdminCount, existing] = await Promise.all([
    prisma.userProfile.count({
      where: {
        role: "ADMIN",
        status: "ACTIVE"
      }
    }),
    prisma.userProfile.findUnique({
      where: {
        id: parsed.data.userId
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        canLinkGoogleCalendar: true,
        permissions: {
          select: {
            module: true,
            action: true,
            allowed: true
          }
        }
      }
    })
  ]);

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
  const calendarPermissionChanged = existing.canLinkGoogleCalendar !== parsed.data.canLinkGoogleCalendar;

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
        canLinkGoogleCalendar: parsed.data.canLinkGoogleCalendar,
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
          status: parsed.data.status,
          canLinkGoogleCalendar: String(parsed.data.canLinkGoogleCalendar)
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

    if (calendarPermissionChanged) {
      activityLogs.push({
        action: "PERMISSIONS_CHANGED",
        actorId: actor.id,
        targetUserId: parsed.data.userId,
        summary: `Updated Google Calendar linking permission for ${existing.email}.`,
        metadata: {
          canLinkGoogleCalendar: String(parsed.data.canLinkGoogleCalendar)
        }
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
    message: "User profile updated.",
    revision: Date.now(),
    user: {
      userId: parsed.data.userId,
      role: parsed.data.role as UserRole,
      status: parsed.data.status as UserStatus,
      canLinkGoogleCalendar: parsed.data.canLinkGoogleCalendar,
      permissions: normalizePermissions(parsed.data.permissions)
    }
  };
}

export async function deleteUserAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    return {
      ok: false,
      message: "Choose a user to delete."
    };
  }

  const [activeAdminCount, existing] = await Promise.all([
    prisma.userProfile.count({
      where: {
        role: "ADMIN",
        status: "ACTIVE"
      }
    }),
    prisma.userProfile.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        authUserId: true,
        email: true,
        role: true,
        status: true
      }
    })
  ]);

  if (!existing) {
    return {
      ok: false,
      message: "User profile was not found."
    };
  }

  if (isProtectedMainAdmin(existing)) {
    return {
      ok: false,
      message: "The main Admin account cannot be deleted."
    };
  }

  if (existing.id === actor.id && existing.role === "ADMIN" && existing.status === "ACTIVE" && activeAdminCount <= 1) {
    return {
      ok: false,
      message: "At least one active Admin must remain."
    };
  }

  if (existing.role === "ADMIN" && existing.status === "ACTIVE" && activeAdminCount <= 1) {
    return {
      ok: false,
      message: "At least one active Admin must remain."
    };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(existing.authUserId);

  if (error && !/not found|does not exist/i.test(error.message)) {
    return {
      ok: false,
      message: "Could not disable the Supabase Auth user."
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({
      where: {
        userId: existing.id
      }
    });

    await tx.userCalendarConnection.updateMany({
      where: {
        userId: existing.id,
        revokedAt: null
      },
      data: {
        revokedAt: new Date(),
        accessToken: null
      }
    });

    await tx.userProfile.update({
      where: {
        id: existing.id
      },
      data: {
        status: "INACTIVE"
      }
    });

    await tx.activityLog.create({
      data: {
        action: "USER_DEACTIVATED",
        actorId: actor.id,
        targetUserId: existing.id,
        summary: `Deleted login access for ${existing.email}.`,
        metadata: {
          previousStatus: existing.status,
          nextStatus: "INACTIVE"
        }
      }
    });
  });

  revalidatePath("/users");
  return {
    ok: true,
    message: "User login access deleted and profile marked inactive."
  };
}
