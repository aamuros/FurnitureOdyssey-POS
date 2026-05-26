export default function QuotationsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-lg bg-muted" />
      </div>

      <section className="studio-card">
        <div className="studio-card-header">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted" />
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_180px_112px] lg:w-auto lg:grid-cols-[260px_150px_180px_112px]">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1040px]">
            <div className="grid grid-cols-9 gap-4 border-b border-border px-5 py-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="h-3 animate-pulse rounded bg-muted" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 7 }).map((_, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-9 gap-4 px-5 py-3">
                  {Array.from({ length: 9 }).map((__, cellIndex) => (
                    <div key={cellIndex} className="h-4 animate-pulse rounded bg-muted/60" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </section>
    </div>
  );
}
