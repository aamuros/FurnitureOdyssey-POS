export default function PaymentsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-muted" />
      </div>

      <section className="studio-card overflow-hidden">
        <div className="grid gap-px border-b border-border bg-border sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="bg-panel px-5 py-4">
              <div className="h-3 w-36 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-5 gap-4 border-b border-border px-5 py-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-3 animate-pulse rounded bg-muted" />
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="grid grid-cols-5 gap-4 px-5 py-3">
                  {Array.from({ length: 5 }).map((__, cellIndex) => (
                    <div key={cellIndex} className="space-y-2">
                      <div className="h-4 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-muted/60" />
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
