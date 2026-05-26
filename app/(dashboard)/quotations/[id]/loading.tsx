export default function QuotationDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-muted" />
      </div>
      <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <section className="studio-card">
            <div className="studio-card-header flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-lg bg-muted/35" />
              ))}
            </div>
          </section>

          <section className="studio-card overflow-hidden">
            <div className="studio-card-header space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-8 gap-4 border-b border-border px-5 py-3">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="h-3 animate-pulse rounded bg-muted" />
                  ))}
                </div>
                <div className="divide-y divide-border">
                  {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-8 gap-4 px-5 py-3">
                      {Array.from({ length: 8 }).map((__, cellIndex) => (
                        <div key={cellIndex} className="h-4 animate-pulse rounded bg-muted/60" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="studio-card">
            <div className="studio-card-header space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-5 w-36 animate-pulse rounded bg-muted" />
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              <div className="h-32 animate-pulse rounded-lg bg-muted/35" />
              <div className="h-32 animate-pulse rounded-lg bg-muted/35" />
            </div>
          </section>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          {Array.from({ length: 2 }).map((_, cardIndex) => (
            <section key={cardIndex} className="studio-card">
              <div className="studio-card-header space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="h-5 w-36 animate-pulse rounded bg-muted" />
              </div>
              <div className="space-y-3 p-5">
                {Array.from({ length: cardIndex === 0 ? 4 : 7 }).map((_, index) => (
                  <div key={index} className="h-10 animate-pulse rounded-lg bg-muted/35" />
                ))}
              </div>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
