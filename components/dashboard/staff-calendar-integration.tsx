import Link from "next/link";
import { CalendarDays, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

type StaffCalendarIntegrationProps = {
  notice?: {
    message: string;
    tone: "success" | "danger";
  };
  connection: {
    connected: boolean;
    googleAccountEmail: string;
    calendarId: string;
    connectedAt: string;
    disconnectedAt: string;
  } | null;
};

export function StaffCalendarIntegration({ notice, connection }: StaffCalendarIntegrationProps) {
  const connected = Boolean(connection?.connected);

  return (
    <section className="studio-card">
      <div className="studio-card-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="studio-kicker">Personal Calendar</p>
          <h2 className="text-sm font-semibold">Google Calendar Integration</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your own Google account for delivery calendar sync.
          </p>
        </div>
        <StatusPill tone={connected ? "success" : connection ? "warning" : "neutral"}>
          {connected ? "Connected" : connection ? "Disconnected" : "Not connected"}
        </StatusPill>
      </div>

      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "mx-5 mb-5 rounded-md border border-success/20 bg-success/10 px-3 py-2 text-sm text-success"
              : "mx-5 mb-5 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
          }
          role="status"
        >
          {notice.message}
        </div>
      ) : null}

      <div className="space-y-4 px-5 pb-5">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-md border border-border bg-background/70 p-3">
            <dt className="text-xs font-medium uppercase text-muted-foreground">Google email</dt>
            <dd className="mt-1 break-words font-medium">{connection?.googleAccountEmail ?? "Not connected"}</dd>
          </div>
          <div className="rounded-md border border-border bg-background/70 p-3">
            <dt className="text-xs font-medium uppercase text-muted-foreground">Calendar ID</dt>
            <dd className="mt-1 break-words font-medium">{connection?.calendarId ?? "Not set"}</dd>
          </div>
          <div className="rounded-md border border-border bg-background/70 p-3">
            <dt className="text-xs font-medium uppercase text-muted-foreground">Connected</dt>
            <dd className="mt-1 font-medium">{connection?.connectedAt ?? "Not connected"}</dd>
          </div>
          <div className="rounded-md border border-border bg-background/70 p-3">
            <dt className="text-xs font-medium uppercase text-muted-foreground">Disconnected</dt>
            <dd className="mt-1 font-medium">{connection?.disconnectedAt ?? "Not set"}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/api/google-calendar/connect"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-soft-accent/70 px-4 text-sm font-semibold text-foreground transition hover:bg-soft-accent"
          >
            <CalendarDays className="h-4 w-4" />
            {connected ? "Reconnect Google Calendar" : "Connect Google Calendar"}
          </Link>
          <form action="/api/google-calendar/disconnect" method="post">
            <Button type="submit" variant="ghost" disabled={!connected}>
              <Unplug className="h-4 w-4" />
              Disconnect Google Calendar
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
