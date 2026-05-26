export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-28 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-border bg-panel p-3">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted/60" />
            </div>
          ))}
        </aside>

        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, cardIndex) => (
            <section key={cardIndex} className="studio-card">
              <div className="studio-card-header space-y-2">
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                <div className="h-5 w-44 animate-pulse rounded bg-muted" />
              </div>
              <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="grid gap-4 md:grid-cols-2">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-10 animate-pulse rounded-lg bg-muted" />
                    </div>
                  ))}
                </div>
                <div className="h-56 animate-pulse rounded-lg bg-muted/35" />
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
