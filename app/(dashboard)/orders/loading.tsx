export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
      </div>
      <div className="rounded-lg border border-border bg-panel p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto]">
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
          <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-10 w-20 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
      <section className="studio-card">
        <div className="studio-card-header">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-5 w-36 animate-pulse rounded bg-muted" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid gap-3 px-5 py-4 md:grid-cols-4">
              <div className="h-10 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
