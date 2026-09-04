import { Skeleton } from "@/components/ui/skeleton";

export function LiveEventSkeleton() {
  return (
    <div className="px-3 py-3">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    </div>
  );
}

export function LeagueListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-xb-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2.5">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 flex-1" style={{ maxWidth: `${55 + ((i * 13) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}

export function MatchRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-start gap-2 border-b border-xb-line px-3 py-3">
      <Skeleton className="mt-1 h-3.5 w-3.5 rounded-full" />
      <div className="w-[330px] space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-2.5 w-52" />
      </div>
      <div className="ml-auto flex gap-1">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-[74px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function MatchesListSkeleton({ groups = 3, cols = 5 }: { groups?: number; cols?: number }) {
  return (
    <div>
      {Array.from({ length: groups }).map((_, g) => (
        <div key={g}>
          <div className="flex items-center gap-2 bg-xb-odds px-3 py-2.5">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-3 w-48" />
          </div>
          {Array.from({ length: 3 }).map((_, r) => (
            <MatchRowSkeleton key={r} cols={cols} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MatchDetailSkeleton() {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl bg-xb-panel shadow-sm">
        <div className="flex items-center gap-2 bg-xb-odds px-3 py-2.5">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="grid grid-cols-3 items-center gap-3 px-4 py-6">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 rounded-xl bg-xb-panel px-3 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl bg-xb-panel shadow-sm">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="bg-xb-odds px-3 py-2.5">
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-12 w-[120px] rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
