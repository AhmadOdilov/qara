import { PageSkeleton, StatRowSkeleton, PanelSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton width="wide">
      {/* Davr filtri */}
      <Skeleton className="mb-6 h-9 w-72" />
      <StatRowSkeleton />
      <div className="mb-4 rounded-card border border-line bg-surface-raised p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <PanelSkeleton lines={5} />
        <PanelSkeleton lines={5} />
      </div>
    </PageSkeleton>
  );
}
