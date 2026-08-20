import { PageSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton width="full">
      <Skeleton className="mb-5 h-9 w-80" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-card border border-line bg-surface-raised p-5">
            <Skeleton className="size-7 rounded-lg" />
            <Skeleton className="mt-3 h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-4/5" />
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}
