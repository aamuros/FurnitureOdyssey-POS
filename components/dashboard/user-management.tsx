"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Pencil,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { inviteUserAction, updateUserAction } from "@/app/actions/users";
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
  invitedAt: string;
  updatedAt: string;
  permissions: PermissionValue[];
};

type UserManagementProps = {
  users: ManagedUser[];
  hasActiveFilters: boolean;
};

type ActionState = {
  ok: boolean;
  message: string;
};

type UserFormProps = {
  mode: "invite" | "edit";
  user?: ManagedUser;
  permissions: PermissionValue[];
  state: ActionState;
  pending: boolean;
  action: (formData: FormData) => void;
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
  permissions,
  state,
  pending,
  action,
  onPermissionsChange,
  onCancel
}: UserFormProps) {
  const isEdit = mode === "edit";
  const [role, setRole] = useState<ManagedUser["role"]>(user?.role ?? "STAFF");

  return (
    <section className="border-y border-border bg-muted/20">
      <div className="px-5 pb-3 pt-5">
        <p className="studio-kicker">{isEdit ? "Staff Profile" : "Team Access"}</p>
        <h2 className="text-base font-semibold">
          {isEdit ? `Edit user access: ${user?.displayName ?? "User"}` : "Invite user"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEdit
            ? "Update role, activation status, and Staff module access for this account."
            : "An email invitation will be sent. The account remains pending until the user accepts and is activated."}
        </p>
      </div>
      <form key={user?.id ?? "invite"} action={action}>
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

          <PermissionEditor role={role} permissions={permissions} onChange={onPermissionsChange} />

          {state.message && !state.ok ? (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{state.message}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-panel/70 px-5 py-4">
          <Button disabled={pending}>
            {isEdit ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {isEdit ? "Save changes" : "Send invite"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      </form>
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
  onInvite
}: {
  hasActiveFilters: boolean;
  onInvite: () => void;
}) {
  return (
    <div className="studio-empty m-5 flex flex-col items-start gap-3 px-5 py-6 text-sm">
      <Users className="h-5 w-5 text-accent" />
      <div>
        <p className="font-medium text-foreground">
          {hasActiveFilters ? "No users match your filters." : "No users yet."}
        </p>
        {!hasActiveFilters ? (
          <p className="mt-1 text-muted-foreground">Invite Admin and Staff accounts for internal access.</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {hasActiveFilters ? (
          <Link href="/users" className="text-sm font-medium text-accent transition hover:text-accent/80">
            Reset filters
          </Link>
        ) : null}
        <Button type="button" variant="secondary" onClick={onInvite}>
          <Plus className="h-4 w-4" />
          Invite user
        </Button>
      </div>
    </div>
  );
}

function UserTable({
  users,
  selectedUserId,
  onEdit
}: {
  users: ManagedUser[];
  selectedUserId: string;
  onEdit: (user: ManagedUser) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="studio-table w-full min-w-[860px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[110px]" />
          <col className="w-[120px]" />
          <col className="w-[22%]" />
          <col className="w-[132px]" />
          <col className="w-[92px]" />
        </colgroup>
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Access</th>
            <th className="px-4 py-3 font-medium">Updated / Invited</th>
            <th className="px-4 py-3 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => (
            <tr key={user.id} className={selectedUserId === user.id ? "bg-soft-accent/35" : undefined}>
              <td className="px-4 py-4 align-middle">
                <p className="font-semibold text-foreground">{user.displayName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
              </td>
              <td className="px-4 py-4 align-middle">
                <StatusPill tone={roleTone(user.role)}>{user.role}</StatusPill>
              </td>
              <td className="px-4 py-4 align-middle">
                <StatusPill tone={statusTone(user.status)}>{user.status}</StatusPill>
              </td>
              <td className="px-4 py-4 align-middle text-muted-foreground">{accessLabel(user)}</td>
              <td className="px-4 py-4 align-middle text-muted-foreground">
                {user.updatedAt !== "Not set" ? user.updatedAt : user.invitedAt}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-right align-middle">
                <Button type="button" variant="secondary" className="min-h-9 px-3" onClick={() => onEdit(user)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UserManagement({ users, hasActiveFilters }: UserManagementProps) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteUserAction, initialState);
  const [updateState, updateAction, updatePending] = useActionState(updateUserAction, initialState);
  const defaultPermissions = useMemo(() => buildDefaultPermissions(), []);
  const [invitePermissions, setInvitePermissions] = useState<PermissionValue[]>(defaultPermissions);
  const [editPermissions, setEditPermissions] = useState<PermissionValue[]>(defaultPermissions);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  useEffect(() => {
    setSelectedUserId((current) => (current && users.some((user) => user.id === current) ? current : ""));
  }, [users]);

  useEffect(() => {
    if (inviteState.message) {
      setNotice(inviteState.message);
      setNoticeTone(inviteState.ok ? "success" : "danger");

      if (inviteState.ok) {
        setShowInviteForm(false);
        setSelectedUserId("");
        setInvitePermissions(defaultPermissions);
      }
    }
  }, [defaultPermissions, inviteState.message, inviteState.ok]);

  useEffect(() => {
    if (updateState.message) {
      setNotice(updateState.message);
      setNoticeTone(updateState.ok ? "success" : "danger");

      if (updateState.ok) {
        setSelectedUserId("");
        setShowInviteForm(false);
      }
    }
  }, [updateState.message, updateState.ok]);

  function openInviteForm() {
    setNotice("");
    setSelectedUserId("");
    setInvitePermissions(defaultPermissions);
    setShowInviteForm(true);
  }

  function openEditForm(user: ManagedUser) {
    setNotice("");
    setShowInviteForm(false);
    setSelectedUserId(user.id);
    setEditPermissions(mergePermissions(defaultPermissions, user.permissions));
  }

  function closeForm() {
    setShowInviteForm(false);
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
              Invite team members, activate accounts, and manage Staff permissions from one list.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={openInviteForm}>
            <Plus className="h-4 w-4" />
            Invite user
          </Button>
        </div>

        {notice ? (
          <UserNotice message={notice} tone={noticeTone} onDismiss={() => setNotice("")} />
        ) : null}

        {showInviteForm ? (
          <UserForm
            mode="invite"
            permissions={invitePermissions}
            state={inviteState}
            pending={invitePending}
            action={inviteAction}
            onPermissionsChange={setInvitePermissions}
            onCancel={closeForm}
          />
        ) : null}

        {selectedUser ? (
          <UserForm
            key={selectedUser.id}
            mode="edit"
            user={selectedUser}
            permissions={editPermissions}
            state={updateState}
            pending={updatePending}
            action={updateAction}
            onPermissionsChange={setEditPermissions}
            onCancel={closeForm}
          />
        ) : null}

        {users.length ? (
          <UserTable users={users} selectedUserId={selectedUserId} onEdit={openEditForm} />
        ) : (
          <UserEmptyState hasActiveFilters={hasActiveFilters} onInvite={openInviteForm} />
        )}
      </section>
    </div>
  );
}
