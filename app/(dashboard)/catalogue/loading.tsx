export default function CatalogueLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-muted" />
      </div>

      <section className="studio-card">
        <div className="studio-card-header space-y-3">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="h-5 w-44 animate-pulse rounded bg-muted" />
          <div className="flex flex-wrap gap-2">
            {["Home", "Chairs", "Tables", "Collections"].map((label) => (
              <div key={label} className="h-9 w-28 animate-pulse rounded-full bg-muted" />
            ))}
          </div>
        </div>

        <div className="grid gap-4 p-4">
          {Array.from({ length: 4 }).map((_, sectionIndex) => (
            <section key={sectionIndex} className="rounded-lg border border-border bg-panel">
              <div className="border-b border-border px-4 py-3">
                <div className="h-4 w-36 animate-pulse rounded bg-muted" />
              </div>
              <div className="grid gap-3 p-4">
                {Array.from({ length: 3 }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="grid gap-3 lg:grid-cols-[minmax(180px,0.34fr)_minmax(260px,1fr)_auto] lg:items-start"
                  >
                    <div className="h-10 animate-pulse rounded-lg bg-muted" />
                    <div className="h-20 animate-pulse rounded-lg bg-muted/35" />
                    <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
