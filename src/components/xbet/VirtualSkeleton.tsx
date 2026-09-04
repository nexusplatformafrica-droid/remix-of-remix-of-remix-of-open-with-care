import { Skeleton } from "@/components/ui/skeleton";

export function VirtualSkeleton() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-xb-page font-xb">
      {/* Header placeholder */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-xb-line bg-xb-header px-3">
        <Skeleton className="h-8 w-28 rounded-md bg-xb-on-dark/15" />
        <div className="hidden flex-1 items-center justify-center gap-4 md:flex">
          <Skeleton className="h-7 w-20 rounded-md bg-xb-on-dark/15" />
          <Skeleton className="h-7 w-20 rounded-md bg-xb-on-dark/15" />
          <Skeleton className="h-7 w-20 rounded-md bg-xb-on-dark/15" />
        </div>
        <Skeleton className="ml-auto h-8 w-24 rounded-md bg-xb-on-dark/15" />
      </div>

      <main className="flex w-full flex-1 flex-col gap-1.5 overflow-hidden px-0 pb-16 pt-1.5 md:px-1.5 md:pb-1.5">
        {/* Top bar */}
        <Skeleton className="h-9 w-full rounded-lg bg-xb-panel" />

        {/* Match cards + sidebar */}
        <div className="grid min-h-0 w-full flex-1 gap-1.5 overflow-hidden lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(260px,22%)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <section
              key={i}
              className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-xb-line bg-xb-panel shadow-sm"
            >
              <Skeleton className="h-7 w-full shrink-0 bg-xb-header" />
              <div className="flex flex-1 flex-col gap-1 p-1">
                {Array.from({ length: 6 }).map((__, gi) => (
                  <div key={gi} className="flex flex-1 flex-col gap-1">
                    <Skeleton className="h-5 w-full bg-xb-panel-alt" />
                    <div className="grid flex-1 grid-cols-3 gap-1">
                      {Array.from({ length: 3 }).map((_, oi) => (
                        <Skeleton key={oi} className="h-full rounded-md bg-xb-odds" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <aside className="flex min-h-0 flex-col gap-2 overflow-hidden">
            {/* Stream skeleton */}
            <div className="overflow-hidden rounded-lg shadow-sm">
              <div className="grid grid-cols-2">
                <Skeleton className="h-7 bg-xb-blue/60" />
                <Skeleton className="h-7 bg-xb-header" />
              </div>
              <Skeleton className="aspect-video w-full bg-xb-panel-alt" />
              <Skeleton className="h-8 w-full bg-xb-blue" />
            </div>

            {/* Bet slip skeleton */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-xb-line bg-xb-panel shadow-sm">
              <Skeleton className="h-9 w-full bg-xb-header" />
              <div className="flex flex-1 flex-col gap-2 p-2">
                <Skeleton className="h-16 w-full bg-xb-panel-alt" />
                <Skeleton className="h-8 w-full bg-xb-odds" />
                <Skeleton className="h-8 w-full bg-xb-odds" />
                <Skeleton className="h-10 w-full bg-xb-green" />
              </div>
            </div>
          </aside>
        </div>

        {/* Results bar */}
        <Skeleton className="h-9 w-full rounded-lg bg-xb-panel" />
      </main>

      {/* Mobile nav */}
      <div className="flex h-14 shrink-0 items-center justify-around border-t border-xb-line bg-xb-nav px-2 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-10 rounded-md bg-xb-on-dark/15" />
        ))}
      </div>
    </div>
  );
}

/** Single match-column placeholder used while the virtual offer loads. */
export function VirtualMatchSkeleton() {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-xb-line bg-xb-panel shadow-sm">
      <Skeleton className="h-6 w-full shrink-0 bg-xb-header" />
      <div className="flex flex-1 flex-col gap-1 p-1">
        {Array.from({ length: 6 }).map((_, gi) => (
          <div key={gi} className="flex flex-1 flex-col gap-1">
            <Skeleton className="h-4 w-full bg-xb-panel-alt" />
            <div className="grid flex-1 grid-cols-3 gap-1">
              {Array.from({ length: 3 }).map((__, oi) => (
                <Skeleton key={oi} className="h-full min-h-[32px] rounded-md bg-xb-odds" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
