"use client";

import { useMemo, useState, useActionState } from "react";
import { Save, Send } from "lucide-react";
import { inviteUserAction, updateUserAction } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { moduleActions, permissionModules, staffDefaultPermissions, type ActionKey, type ModuleKey } from "@/lib/auth/permissions";

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
  permissions: PermissionValue[];
};

type UserManagementProps = {
  users: ManagedUser[];
};

const initialState = {
  ok: false,
  message: ""
};

function buildDefaultPermissions(): PermissionValue[] {
  return Object.entries(moduleActions).flatMap(([module, actions]) =>
    actions.map((action) => ({
      module: module as ModuleKey,
      action,
      allowed: staffDefaultPermissions[module as ModuleKey]?.includes(action) ?? false
    }))
  );
}

function PermissionEditor({
  permissions,
  onChange
}: {
  permissions: PermissionValue[];
  onChange: (permissions: PermissionValue[]) => void;
}) {
  function toggle(module: ModuleKey, action: ActionKey) {
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
      {Object.entries(moduleActions).map(([module, actions]) => (
        <div key={module} className="rounded-md border border-border">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">
            {permissionModules[module as ModuleKey]}
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
            {actions.map((action) => {
              const checked =
                permissions.find(
                  (permission) => permission.module === module && permission.action === action
                )?.allowed ?? false;

              return (
                <label key={action} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(module as ModuleKey, action)}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  {action.toLowerCase()}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function UserManagement({ users }: UserManagementProps) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteUserAction,
    initialState
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateUserAction,
    initialState
  );
  const defaultPermissions = useMemo(() => buildDefaultPermissions(), []);
  const [invitePermissions, setInvitePermissions] =
    useState<PermissionValue[]>(defaultPermissions);
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const selectedUser = users.find((user) => user.id === selectedUserId);
  const selectedPermissions = useMemo(() => {
    if (!selectedUser) {
      return defaultPermissions;
    }

    return defaultPermissions.map((permission) => {
      const savedPermission = selectedUser.permissions.find(
        (item) => item.module === permission.module && item.action === permission.action
      );

      return {
        ...permission,
        allowed: savedPermission?.allowed ?? false
      };
    });
  }, [defaultPermissions, selectedUser]);
  const [editPermissions, setEditPermissions] = useState<PermissionValue[]>(selectedPermissions);

  function handleSelectedUserChange(userId: string) {
    const nextUser = users.find((user) => user.id === userId);
    setSelectedUserId(userId);
    setEditPermissions(
      defaultPermissions.map((permission) => {
        const savedPermission = nextUser?.permissions.find(
          (item) => item.module === permission.module && item.action === permission.action
        );

        return {
          ...permission,
          allowed: savedPermission?.allowed ?? false
        };
      })
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="studio-card">
        <div className="studio-card-header">
          <p className="studio-kicker">Team Access</p>
          <h2 className="text-sm font-semibold">Invite user</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Supabase sends the invite. The profile remains pending until activated.
          </p>
        </div>
        <form action={inviteAction} className="space-y-4 p-5">
          <input type="hidden" name="permissions" value={JSON.stringify(invitePermissions)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Display name
              <Input name="displayName" required />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Email
              <Input name="email" type="email" required />
            </label>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            Role
            <Select name="role" defaultValue="STAFF">
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </label>
          <PermissionEditor permissions={invitePermissions} onChange={setInvitePermissions} />
          {inviteState.message ? (
            <p className={inviteState.ok ? "text-sm text-success" : "text-sm text-danger"}>
              {inviteState.message}
            </p>
          ) : null}
          <Button disabled={invitePending}>
            <Send className="h-4 w-4" />
            Send invite
          </Button>
        </form>
      </section>

      <section className="studio-card">
        <div className="studio-card-header">
          <p className="studio-kicker">Staff Profile</p>
          <h2 className="text-sm font-semibold">Manage access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin users bypass Staff permission flags.
          </p>
        </div>
        <div className="border-b border-border p-5">
          <label className="block space-y-2 text-sm font-medium">
            User
            <Select
              value={selectedUserId}
              onChange={(event) => handleSelectedUserChange(event.target.value)}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} - {user.email}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {selectedUser ? (
          <form action={updateAction} className="space-y-4 p-5">
            <input type="hidden" name="userId" value={selectedUser.id} />
            <input type="hidden" name="permissions" value={JSON.stringify(editPermissions)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                Display name
                <Input name="displayName" defaultValue={selectedUser.displayName} required />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Email
                <Input value={selectedUser.email} disabled />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Role
                <Select name="role" defaultValue={selectedUser.role}>
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                Status
                <Select name="status" defaultValue={selectedUser.status}>
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </label>
            </div>
            <PermissionEditor permissions={editPermissions} onChange={setEditPermissions} />
            {updateState.message ? (
              <p className={updateState.ok ? "text-sm text-success" : "text-sm text-danger"}>
                {updateState.message}
              </p>
            ) : null}
            <Button disabled={updatePending}>
              <Save className="h-4 w-4" />
              Save changes
            </Button>
          </form>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No users found.</p>
        )}
      </section>

      <section className="studio-card xl:col-span-2">
        <div className="studio-card-header">
          <p className="studio-kicker">Permissions</p>
          <h2 className="text-sm font-semibold">Current users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Enabled permissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3 font-medium">{user.displayName}</td>
                  <td className="px-5 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-5 py-3">{user.role}</td>
                  <td className="px-5 py-3">
                    <StatusPill
                      tone={
                        user.status === "ACTIVE"
                          ? "success"
                          : user.status === "PENDING"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {user.status}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {user.role === "ADMIN"
                      ? "All modules"
                      : user.permissions.filter((permission) => permission.allowed).length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
