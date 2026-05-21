import Link from "next/link";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { UserManagement } from "@/components/dashboard/user-management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/server";

type UsersPageProps = {
  searchParams?: Promise<{
    q?: string;
    role?: string;
    status?: string;
    page?: string;
  }>;
};

const pageSize = 25;

function formatDate(value: Date | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function usersHref(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined> = {}
) {
  const next = new URLSearchParams();

  for (const [paramKey, paramValue] of Object.entries(params)) {
    if (paramValue && paramKey !== "page") {
      next.set(paramKey, paramValue);
    }
  }

  for (const [paramKey, paramValue] of Object.entries(updates)) {
    if (paramValue) {
      next.set(paramKey, paramValue);
    } else {
      next.delete(paramKey);
    }
  }

  const query = next.toString();
  return query ? `/users?${query}` : "/users";
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim();
  const role = params.role === "ADMIN" || params.role === "STAFF" ? params.role : undefined;
  const status =
    params.status === "PENDING" || params.status === "ACTIVE" || params.status === "INACTIVE"
      ? params.status
      : undefined;
  const page = Math.max(Number(params.page ?? 1) || 1, 1);
  const hasActiveFilters = Boolean(query || role || status);
  const userWhere: Prisma.UserProfileWhereInput = {
    role,
    status,
    OR: query
      ? [
          { displayName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } }
        ]
      : undefined
  };

  const [users, userCount] = await Promise.all([
    prisma.userProfile.findMany({
      where: userWhere,
      orderBy: [
        {
          role: "asc"
        },
        {
          displayName: "asc"
        }
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        invitedAt: true,
        updatedAt: true,
        permissions: {
          select: {
            module: true,
            action: true,
            allowed: true
          }
        }
      }
    }),
    prisma.userProfile.count({
      where: userWhere
    })
  ]);
  const totalPages = Math.max(Math.ceil(userCount / pageSize), 1);
  const pageParams = {
    q: params.q,
    role: params.role,
    status: params.status
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Admin-only control for invited accounts, role assignment, activation, and Staff permissions."
      />
      <form className="mb-6 grid gap-3 rounded-lg border border-border bg-panel p-4 md:grid-cols-[minmax(260px,1fr)_170px_170px_auto]">
        <Input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search display name or email"
          className="md:min-w-[300px]"
        />
        <Select name="role" defaultValue={params.role ?? ""}>
          <option value="">All roles</option>
          <option value="ADMIN">Admin</option>
          <option value="STAFF">Staff</option>
        </Select>
        <Select name="status" defaultValue={params.status ?? ""}>
          <option value="">Any status</option>
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary">
            Filter
          </Button>
          {hasActiveFilters ? (
            <Link href="/users" className="text-sm font-medium text-accent transition hover:text-accent/80">
              Reset filters
            </Link>
          ) : null}
        </div>
      </form>
      <UserManagement
        hasActiveFilters={hasActiveFilters}
        users={users.map((user) => ({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          status: user.status,
          invitedAt: formatDate(user.invitedAt),
          updatedAt: formatDate(user.updatedAt),
          permissions: user.permissions
        }))}
      />
      {totalPages > 1 ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
          <span>
            Showing {users.length} of {userCount} user(s), page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page <= 1 ? (
              <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-md border border-border bg-panel px-4 text-sm font-medium opacity-60">
                Previous
              </span>
            ) : (
              <Link
                href={usersHref(pageParams, { page: String(page - 1) })}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-panel px-4 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Previous
              </Link>
            )}
            {page >= totalPages ? (
              <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-md border border-border bg-panel px-4 text-sm font-medium opacity-60">
                Next
              </span>
            ) : (
              <Link
                href={usersHref(pageParams, { page: String(page + 1) })}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-panel px-4 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
