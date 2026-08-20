import { PageSkeleton, StatRowSkeleton, CardGridSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton width="wide">
      <StatRowSkeleton />
      <div className="mb-8 rounded-card border border-line bg-surface-raised p-5">
        <Skeleton className="h-4 w-36" />
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      </div>
      <CardGridSkeleton count={4} />
    </PageSkeleton>
  );
}
