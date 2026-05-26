export default function EditQuotationLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />
      </div>

      <div className="grid gap-2 md:grid-cols-2 lg:max-w-[420px]">
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="studio-card min-w-0">
            <div className="studio-card-header flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-5 w-36 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[920px]">
                <div className="grid grid-cols-8 gap-2 border-b border-border bg-soft-accent/35 px-3 py-2">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="h-3 animate-pulse rounded bg-muted" />
                  ))}
                </div>
                <div className="divide-y divide-border">
                  {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-8 gap-2 px-3 py-3">
                      {Array.from({ length: 8 }).map((__, cellIndex) => (
                        <div key={cellIndex} className="h-9 animate-pulse rounded bg-muted/60" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="studio-card min-w-0">
            <div className="studio-card-header space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            </div>
            <div className="grid gap-4 border-t border-border p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
              <div className="h-24 animate-pulse rounded-lg bg-muted/35" />
              <div className="h-24 animate-pulse rounded-lg bg-muted/35" />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="studio-card">
            <div className="studio-card-header space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-5 w-36 animate-pulse rounded bg-muted" />
            </div>
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex justify-between gap-4">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </div>
              ))}
              <div className="h-12 animate-pulse rounded-lg bg-muted/35" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
