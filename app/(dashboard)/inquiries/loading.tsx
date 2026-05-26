export default function InquiriesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-3xl animate-pulse rounded bg-muted" />
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-panel p-4 md:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_auto]">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="studio-card overflow-hidden">
          <div className="studio-card-header space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="p-4">
                <div className="h-4 w-44 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted/60" />
                <div className="mt-3 flex gap-2">
                  <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                  <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="studio-card">
          <div className="studio-card-header space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-5 w-44 animate-pulse rounded bg-muted" />
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-muted/35" />
            ))}
          </div>
          <div className="border-t border-border p-5">
            <div className="h-28 animate-pulse rounded-lg bg-muted/35" />
          </div>
        </section>
      </div>
    </div>
  );
}
