export default function SalesHistoryLoading() {
  return (
    <div className="space-y-3">
      <div className="space-y-2 pb-3">
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-muted" />
      </div>

      <nav className="flex gap-1.5 overflow-x-auto pb-1">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-8 w-28 shrink-0 animate-pulse rounded-full bg-muted" />
        ))}
      </nav>

      <div className="space-y-2.5 rounded-lg border border-border bg-panel p-3">
        <div className="grid items-center gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_180px_minmax(260px,300px)_112px_auto]">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="border-t border-border pt-2.5">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-2.5 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>

      <section className="studio-card overflow-hidden">
        <div className="studio-card-header space-y-2 px-4 py-2.5">
          <div className="h-4 w-44 animate-pulse rounded bg-muted" />
          <div className="h-3 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[1040px]">
            <div className="grid grid-cols-8 gap-4 border-b border-border px-4 py-2.5">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-3 animate-pulse rounded bg-muted" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="grid grid-cols-8 gap-4 px-4 py-3">
                  {Array.from({ length: 8 }).map((__, cellIndex) => (
                    <div key={cellIndex} className="h-4 animate-pulse rounded bg-muted/60" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </section>
    </div>
  );
}
