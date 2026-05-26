export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-44 animate-pulse rounded bg-muted" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="studio-card p-4">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-36 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="studio-card overflow-hidden">
          <div className="px-5 py-4">
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-2 border-t border-border p-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-md px-3 py-3">
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-full max-w-xl animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          {Array.from({ length: 2 }).map((_, cardIndex) => (
            <section key={cardIndex} className="studio-card overflow-hidden">
              <div className="px-5 py-4">
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              </div>
              <div className="space-y-3 border-t border-border px-5 py-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                      <div className="mt-2 h-3 w-48 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
