export default function ProductsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-28 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-3 rounded-lg border border-border bg-panel p-4 md:grid-cols-[1.4fr_0.75fr_0.9fr_0.9fr_auto]">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <section className="studio-card h-72 animate-pulse bg-muted/35" />
          <section className="studio-card h-72 animate-pulse bg-muted/35" />
        </div>
        <section className="studio-card overflow-hidden">
          <div className="studio-card-header space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse bg-muted/35" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
