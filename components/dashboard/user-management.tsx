"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Unplug,
  Users,
  X
} from "lucide-react";
import { createUserAction, deleteUserAction, updateUserAction } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import {
  moduleActions,
  permissionModules,
  staffDefaultPermissions,
  type ActionKey,
  type ModuleKey
} from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type PermissionValue = {
  module: ModuleKey;
  action: ActionKey;
  allowed: boolean;
};

type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  role: "ADMIN" | "STAFF";
  status: "PENDING" | "ACTIVE" | "INACTIVE";
  canLinkGoogleCalendar: boolean;
  invitedAt: string;
  updatedAt: string;
  permissions: PermissionValue[];
  calendarConnection: {
    connected: boolean;
    googleAccountEmail: string;
    calendarId: string;
    connectedAt: string;
    disconnectedAt: string;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
  } | null;
  isProtectedMainAdmin: boolean;
};

type UserManagementProps = {
  users: ManagedUser[];
  hasActiveFilters: boolean;
  currentUserId: string;
  initialNotice?: {
    message: string;
    tone: "success" | "danger";
  };
};

type ActionState = {
  ok: boolean;
  message: string;
};

type UserFormProps = {
  mode: "create" | "edit";
  user?: ManagedUser;
  currentUserId: string;
  permissions: PermissionValue[];
  state: ActionState;
  pending: boolean;
  action: (formData: FormData) => void;
  deleteAction?: (formData: FormData) => void;
  onPermissionsChange: (permissions: PermissionValue[]) => void;
  onCancel: () => void;
};

const initialState = {
  ok: false,
  message: ""
};

const fieldClassName = "flex min-h-[78px] flex-col gap-2 text-sm font-medium";

function buildDefaultPermissions(): PermissionValue[] {
  return Object.entries(moduleActions).flatMap(([module, actions]) =>
    actions.map((action) => ({
      module: module as ModuleKey,
      action,
      allowed: staffDefaultPermissions[module as ModuleKey]?.includes(action) ?? false
    }))
  );
}

function mergePermissions(defaultPermissions: PermissionValue[], savedPermissions: PermissionValue[]) {
  return defaultPermissions.map((permission) => {
    const savedPermission = savedPermissions.find(
      (item) => item.module === permission.module && item.action === permission.action
    );

    return {
      ...permission,
      allowed: savedPermission?.allowed ?? false
    };
  });
}

function statusTone(status: ManagedUser["status"]) {
  if (status === "ACTIVE") {
    return "success";
  }

  return status === "PENDING" ? "warning" : "danger";
}

function roleTone(role: ManagedUser["role"]) {
  return role === "ADMIN" ? "teal" : "neutral";
}

function accessLabel(user: ManagedUser) {
  if (user.role === "ADMIN") {
    return "Full access";
  }

  const enabledCount = user.permissions.filter((permission) => permission.allowed).length;
  return `${enabledCount} enabled permission${enabledCount === 1 ? "" : "s"}`;
}

function calendarStatusLabel(user: ManagedUser) {
  if (!user.canLinkGoogleCalendar && user.role !== "ADMIN") {
    return "Linking not allowed";
  }

  if (!user.calendarConnection) {
    return "Not connected";
  }

  if (!user.calendarConnection.connected) {
    return "Revoked / Disconnected";
  }

  return `Connected: ${user.calendarConnection.googleAccountEmail}`;
}

function calendarStatusTone(user: ManagedUser) {
  if (!user.canLinkGoogleCalendar && user.role !== "ADMIN") {
    return "neutral" as const;
  }

  if (!user.calendarConnection) {
    return "neutral" as const;
  }

  return user.calendarConnection.connected ? "success" as const : "warning" as const;
}

function PermissionEditor({
  role,
  permissions,
  onChange
}: {
  role: ManagedUser["role"];
  permissions: PermissionValue[];
  onChange: (permissions: PermissionValue[]) => void;
}) {
  const isAdmin = role === "ADMIN";

  function toggle(module: ModuleKey, action: ActionKey) {
    if (isAdmin) {
      return;
    }

    onChange(
      permissions.map((permission) =>
        permission.module === module && permission.action === action
          ? {
              ...permission,
              allowed: !permission.allowed
            }
          : permission
      )
    );
  }

  return (
    <div className="space-y-3">
      {isAdmin ? (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-3 text-sm text-primary">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Admins have full access to all modules. Staff permission flags do not apply.</p>
        </div>
      ) : null}
      <div className={cn("grid gap-3 lg:grid-cols-2", isAdmin && "opacity-60")}>
        {Object.entries(moduleActions).map(([module, actions]) => {
          const typedModule = module as ModuleKey;
          const enabledCount = actions.filter(
            (action) =>
              permissions.find(
                (permission) => permission.module === typedModule && permission.action === action
              )?.allowed
          ).length;

          return (
            <div key={module} className="rounded-lg border border-border bg-panel/70">
              <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                <h3 className="text-sm font-semibold">{permissionModules[typedModule]}</h3>
                <span className="text-xs text-muted-foreground">
                  {enabledCount} of {actions.length} enabled
                </span>
              </div>
              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {actions.map((action) => {
                  const checked =
                    permissions.find(
                      (permission) => permission.module === typedModule && permission.action === action
                    )?.allowed ?? false;

                  return (
                    <label
                      key={action}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground",
                        isAdmin ? "cursor-not-allowed text-muted-foreground" : "hover:bg-muted/55"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isAdmin}
                        onChange={() => toggle(typedModule, action)}
                        className="h-4 w-4 accent-[hsl(var(--primary))] disabled:cursor-not-allowed"
                      />
                      <span className="capitalize">{action.toLowerCase()}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UserForm({
  mode,
  user,
  currentUserId,
  permissions,
  state,
  pending,
  action,
  deleteAction,
  onPermissionsChange,
  onCancel
}: UserFormProps) {
  const isEdit = mode === "edit";
  const [role, setRole] = useState<ManagedUser["role"]>(user?.role ?? "STAFF");
  const [showPassword, setShowPassword] = useState(false);
  const isCurrentUser = Boolean(user && user.id === currentUserId);
  const calendarConnection = user?.calendarConnection ?? null;
  const calendarConnected = Boolean(calendarConnection?.connected);
  const disconnectFormId = user ? `disconnect-calendar-${user.id}` : undefined;

  return (
    <section className="border-y border-border bg-muted/20">
      <div className="px-5 pb-3 pt-5">
        <p className="studio-kicker">{isEdit ? "Staff Profile" : "Team Access"}</p>
        <h2 className="text-base font-semibold">
          {isEdit ? `Edit user access: ${user?.displayName ?? "User"}` : "Create user"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEdit
            ? "Update role, activation status, and Staff module access for this account."
            : "Create a login account for a team member. Share the temporary password securely."}
        </p>
      </div>
      <form key={user?.id ?? "create"} action={action}>
        {isEdit && user ? <input type="hidden" name="userId" value={user.id} /> : null}
        <input type="hidden" name="permissions" value={JSON.stringify(permissions)} />

        <div className="space-y-4 px-5 pb-5 pt-2">
          <div className="grid gap-4 md:grid-cols-2">
            <label className={fieldClassName}>
              Display name
              <Input name="displayName" required defaultValue={user?.displayName ?? ""} placeholder="Team member name" />
            </label>
            {isEdit && user ? (
              <label className={fieldClassName}>
                Email
                <Input value={user.email} disabled />
              </label>
            ) : (
              <label className={fieldClassName}>
                Email
                <Input name="email" type="email" required placeholder="name@example.com" />
              </label>
            )}
          </div>

          {!isEdit ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldClassName}>
                Temporary password
                <div className="flex gap-2">
                  <Input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-10 px-3"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </label>
              <label className={fieldClassName}>
                Confirm temporary password
                <Input
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Repeat temporary password"
                />
              </label>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className={fieldClassName}>
              Role
              <Select
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as ManagedUser["role"])}
              >
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </Select>
              <span className="block text-xs font-normal leading-4 text-muted-foreground">
                Admins bypass Staff permission flags.
              </span>
            </label>
            {isEdit ? (
              <label className={fieldClassName}>
                Status
                <Select name="status" defaultValue={user?.status ?? "PENDING"}>
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
                <span className="block text-xs font-normal leading-4 text-muted-foreground">
                  At least one active Admin must remain.
                </span>
              </label>
            ) : null}
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-panel/70 p-4 text-sm">
            <input
              type="checkbox"
              name="canLinkGoogleCalendar"
              value="true"
              defaultChecked={user?.canLinkGoogleCalendar ?? false}
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
            />
            <span>
              <span className="block font-semibold">Allow Google Calendar integration</span>
              <span className="mt-1 block text-muted-foreground">
                Staff with this enabled can open Users and manage only their own Google Calendar connection.
              </span>
            </span>
          </label>

          <PermissionEditor role={role} permissions={permissions} onChange={onPermissionsChange} />

          {isEdit && user ? (
            <section className="rounded-lg border border-border bg-panel/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Calendar Integration</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {calendarStatusLabel(user)}
                  </p>
                </div>
                <StatusPill tone={calendarStatusTone(user)}>
                  {calendarConnected ? "Connected" : calendarConnection ? "Revoked / Disconnected" : "Not connected"}
                </StatusPill>
              </div>

              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-md border border-border bg-background/70 p-3">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Google email</dt>
                  <dd className="mt-1 break-words font-medium">
                    {calendarConnection?.googleAccountEmail ?? "Not connected"}
                  </dd>
                </div>
                <div className="rounded-md border border-border bg-background/70 p-3">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Calendar ID</dt>
                  <dd className="mt-1 break-words font-medium">{calendarConnection?.calendarId ?? "Not set"}</dd>
                </div>
                <div className="rounded-md border border-border bg-background/70 p-3">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Connected</dt>
                  <dd className="mt-1 font-medium">{calendarConnection?.connectedAt ?? "Not connected"}</dd>
                </div>
                <div className="rounded-md border border-border bg-background/70 p-3">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Disconnected</dt>
                  <dd className="mt-1 font-medium">{calendarConnection?.disconnectedAt ?? "Not set"}</dd>
                </div>
              </dl>

              {calendarConnection?.lastSyncError ? (
                <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                  {calendarConnection.lastSyncError}
                </p>
              ) : null}

              {!isCurrentUser ? (
                <p className="mt-3 rounded-md border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
                  Google OAuth connects the currently signed-in account. Staff should connect their own calendar
                  from their own session/profile.
                </p>
              ) : null}

              {isCurrentUser ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href="/api/google-calendar/connect"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-soft-accent/70 px-4 text-sm font-semibold text-foreground transition hover:bg-soft-accent"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Connect Google Calendar
                  </Link>
                  <Button
                    type="submit"
                    form={disconnectFormId}
                    variant="ghost"
                    disabled={!calendarConnected}
                    onClick={(event) => {
                      if (!window.confirm("Disconnect your Google Calendar from this account?")) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <Unplug className="h-4 w-4" />
                    Disconnect Google Calendar
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  This user must sign in and connect their own Google Calendar.
                </p>
              )}
            </section>
          ) : null}

          {state.message && !state.ok ? (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{state.message}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-panel/70 px-5 py-4">
          <Button disabled={pending}>
            {isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEdit ? "Save changes" : "Create user"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          {isEdit && user && deleteAction ? (
            <Button
              type="submit"
              form={`delete-user-${user.id}`}
              variant="ghost"
              disabled={user.isProtectedMainAdmin}
              className="ml-auto text-danger hover:bg-danger/10"
              onClick={(event) => {
                if (!window.confirm(`Delete login access for ${user.email}? This marks the profile inactive.`)) {
                  event.preventDefault();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete user
            </Button>
          ) : null}
        </div>
      </form>
      {isEdit && user ? (
        <>
          <form id={disconnectFormId} action="/api/google-calendar/disconnect" method="post" />
          {deleteAction ? (
            <form id={`delete-user-${user.id}`} action={deleteAction}>
              <input type="hidden" name="userId" value={user.id} />
            </form>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function UserNotice({
  message,
  tone,
  onDismiss
}: {
  message: string;
  tone: "success" | "danger";
  onDismiss: () => void;
}) {
  const isDanger = tone === "danger";

  return (
    <div
      className={
        isDanger
          ? "mx-5 mb-5 flex items-start gap-3 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
          : "mx-5 mb-5 flex items-start gap-3 rounded-md border border-success/20 bg-success/10 px-3 py-2 text-sm text-success"
      }
      role="status"
    >
      {isDanger ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <p className="min-w-0 flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md p-1 transition hover:bg-background/50"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function UserEmptyState({
  hasActiveFilters,
  onCreate
}: {
  hasActiveFilters: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="studio-empty m-5 flex flex-col items-start gap-3 px-5 py-6 text-sm">
      <Users className="h-5 w-5 text-accent" />
      <div>
        <p className="font-medium text-foreground">
          {hasActiveFilters ? "No users match your filters." : "No users yet."}
        </p>
        {!hasActiveFilters ? (
          <p className="mt-1 text-muted-foreground">Create Admin and Staff login accounts for internal access.</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {hasActiveFilters ? (
          <Link href="/users" className="text-sm font-medium text-accent transition hover:text-accent/80">
            Reset filters
          </Link>
        ) : null}
        <Button type="button" variant="secondary" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Create user
        </Button>
      </div>
    </div>
  );
}

function UserTable({
  users,
  selectedUserId,
  onEdit,
  deleteAction
}: {
  users: ManagedUser[];
  selectedUserId: string;
  onEdit: (user: ManagedUser) => void;
  deleteAction: (formData: FormData) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="studio-table w-full min-w-[980px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[96px]" />
          <col className="w-[108px]" />
          <col className="w-[15%]" />
          <col className="w-[22%]" />
          <col className="w-[120px]" />
          <col className="w-[150px]" />
        </colgroup>
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Access</th>
            <th className="px-4 py-3 font-medium">Calendar</th>
            <th className="px-4 py-3 font-medium">Updated / Created</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => (
            <tr key={user.id} className={selectedUserId === user.id ? "bg-soft-accent/35" : undefined}>
              <td className="px-4 py-4 align-middle">
                <p className="font-semibold text-foreground">{user.displayName}</p>
                <p className="mt-1 break-words text-xs text-muted-foreground">{user.email}</p>
                {user.isProtectedMainAdmin ? (
                  <p className="mt-1 text-xs font-medium text-primary">Main admin</p>
                ) : null}
              </td>
              <td className="px-4 py-4 align-middle">
                <StatusPill tone={roleTone(user.role)}>{user.role}</StatusPill>
              </td>
              <td className="px-4 py-4 align-middle">
                <StatusPill tone={statusTone(user.status)}>{user.status}</StatusPill>
              </td>
              <td className="px-4 py-4 align-middle text-muted-foreground">{accessLabel(user)}</td>
              <td className="px-4 py-4 align-middle">
                <div className="space-y-1">
                  <StatusPill tone={calendarStatusTone(user)}>
                    {user.calendarConnection?.connected
                      ? "Connected"
                      : user.calendarConnection
                        ? "Revoked / Disconnected"
                        : "Not connected"}
                  </StatusPill>
                  <p className="break-words text-xs text-muted-foreground">{calendarStatusLabel(user)}</p>
                </div>
              </td>
              <td className="px-4 py-4 align-middle text-xs text-muted-foreground">
                {user.updatedAt !== "Not set" ? user.updatedAt : user.invitedAt}
              </td>
              <td className="px-4 py-4 text-right align-middle">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" className="min-h-9 px-3" onClick={() => onEdit(user)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <form action={deleteAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      className="min-h-9 px-3 text-danger hover:bg-danger/10"
                      disabled={user.isProtectedMainAdmin}
                      onClick={(event) => {
                        if (!window.confirm(`Delete login access for ${user.email}? This marks the profile inactive.`)) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UserManagement({
  users,
  hasActiveFilters,
  currentUserId,
  initialNotice
}: UserManagementProps) {
  const [createState, createAction, createPending] = useActionState(createUserAction, initialState);
  const [updateState, updateAction, updatePending] = useActionState(updateUserAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteUserAction, initialState);
  const defaultPermissions = useMemo(() => buildDefaultPermissions(), []);
  const [createPermissions, setCreatePermissions] = useState<PermissionValue[]>(defaultPermissions);
  const [editPermissions, setEditPermissions] = useState<PermissionValue[]>(defaultPermissions);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notice, setNotice] = useState(initialNotice?.message ?? "");
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">(initialNotice?.tone ?? "success");
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  useEffect(() => {
    setSelectedUserId((current) => (current && users.some((user) => user.id === current) ? current : ""));
  }, [users]);

  useEffect(() => {
    if (createState.message) {
      setNotice(createState.message);
      setNoticeTone(createState.ok ? "success" : "danger");

      if (createState.ok) {
        setShowCreateForm(false);
        setSelectedUserId("");
        setCreatePermissions(defaultPermissions);
      }
    }
  }, [defaultPermissions, createState.message, createState.ok]);

  useEffect(() => {
    if (updateState.message) {
      setNotice(updateState.message);
      setNoticeTone(updateState.ok ? "success" : "danger");

      if (updateState.ok) {
        setSelectedUserId("");
        setShowCreateForm(false);
      }
    }
  }, [updateState.message, updateState.ok]);

  useEffect(() => {
    if (deleteState.message) {
      setNotice(deleteState.message);
      setNoticeTone(deleteState.ok ? "success" : "danger");

      if (deleteState.ok) {
        setSelectedUserId("");
        setShowCreateForm(false);
      }
    }
  }, [deleteState.message, deleteState.ok]);

  function openCreateForm() {
    setNotice("");
    setSelectedUserId("");
    setCreatePermissions(defaultPermissions);
    setShowCreateForm(true);
  }

  function openEditForm(user: ManagedUser) {
    setNotice("");
    setShowCreateForm(false);
    setSelectedUserId(user.id);
    setEditPermissions(mergePermissions(defaultPermissions, user.permissions));
  }

  function closeForm() {
    setShowCreateForm(false);
    setSelectedUserId("");
  }

  return (
    <div className="space-y-6">
      <section className="studio-card">
        <div className="studio-card-header flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="studio-kicker">Team Access</p>
            <h2 className="text-sm font-semibold">User list</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create team login accounts, activate accounts, and manage Staff permissions from one list.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={openCreateForm}>
            <Plus className="h-4 w-4" />
            Create user
          </Button>
        </div>

        {notice ? (
          <UserNotice message={notice} tone={noticeTone} onDismiss={() => setNotice("")} />
        ) : null}

        {showCreateForm ? (
          <UserForm
            mode="create"
            currentUserId={currentUserId}
            permissions={createPermissions}
            state={createState}
            pending={createPending}
            action={createAction}
            onPermissionsChange={setCreatePermissions}
            onCancel={closeForm}
          />
        ) : null}

        {selectedUser ? (
          <UserForm
            key={selectedUser.id}
            mode="edit"
            user={selectedUser}
            currentUserId={currentUserId}
            permissions={editPermissions}
            state={updateState}
            pending={updatePending}
            action={updateAction}
            deleteAction={deleteAction}
            onPermissionsChange={setEditPermissions}
            onCancel={closeForm}
          />
        ) : null}

        {users.length ? (
          <UserTable
            users={users}
            selectedUserId={selectedUserId}
            onEdit={openEditForm}
            deleteAction={deleteAction}
          />
        ) : (
          <UserEmptyState hasActiveFilters={hasActiveFilters} onCreate={openCreateForm} />
        )}
      </section>
    </div>
  );
}
