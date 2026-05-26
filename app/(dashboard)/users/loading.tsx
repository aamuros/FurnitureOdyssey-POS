export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-panel p-4 md:grid-cols-[minmax(260px,1fr)_170px_170px_auto]">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>

      <section className="studio-card overflow-hidden">
        <div className="studio-card-header flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-5 gap-4 border-b border-border px-5 py-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-3 animate-pulse rounded bg-muted" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="grid grid-cols-5 gap-4 px-5 py-4">
                  {Array.from({ length: 5 }).map((__, cellIndex) => (
                    <div key={cellIndex} className="h-4 animate-pulse rounded bg-muted/60" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-lg border border-border bg-panel px-4 py-3">
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-16 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}
