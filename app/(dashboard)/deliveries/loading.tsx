export default function DeliveriesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-muted" />
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-panel p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_auto_auto]">
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
          <div className="h-10 w-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-10 w-20 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="border-t border-border pt-3">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>

      <section className="studio-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-5 gap-4 border-b border-border bg-background px-4 py-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-3 animate-pulse rounded bg-muted" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="grid grid-cols-5 gap-4 px-4 py-3">
                  {Array.from({ length: 5 }).map((__, cellIndex) => (
                    <div key={cellIndex} className="space-y-2">
                      <div className="h-4 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-3/4 animate-pulse rounded bg-muted/60" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
