/**
 * Instant route-change placeholder.
 *
 * Rendered by the router as `defaultPendingComponent` with `defaultPendingMs: 0`
 * so tapping a nav item swaps in a skeleton immediately instead of leaving the
 * previous page frozen or forcing a full page reload.
 */
export function PageLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] animate-pulse bg-xb-page p-2 md:p-3">
      <div className="h-6 w-40 rounded bg-xb-odds" />
      <div className="mt-2 h-[120px] w-full rounded-lg bg-xb-odds md:h-[180px]" />

      <div className="mt-3 grid gap-3 md:grid-cols-[240px_1fr_300px]">
        <div className="hidden flex-col gap-2 md:flex">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-7 rounded bg-xb-odds" />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="h-8 rounded bg-xb-odds" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-10 flex-1 rounded bg-xb-odds" />
              <div className="h-10 w-14 rounded bg-xb-odds" />
              <div className="h-10 w-14 rounded bg-xb-odds" />
              <div className="h-10 w-14 rounded bg-xb-odds" />
            </div>
          ))}
        </div>

        <div className="hidden flex-col gap-2 md:flex">
          <div className="h-8 rounded bg-xb-odds" />
          <div className="h-40 rounded bg-xb-odds" />
          <div className="h-24 rounded bg-xb-odds" />
        </div>
      </div>
    </div>
  );
}
