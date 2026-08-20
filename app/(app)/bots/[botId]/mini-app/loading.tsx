import { PageSkeleton, PanelSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton width="full">
      {/* Konstruktor uch ustunli — skelet ham shu shaklda turadi */}
      <div className="grid gap-3 lg:grid-cols-[220px_1fr_260px]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="hidden h-96 w-full lg:block" />
      </div>
      <div className="mt-4">
        <PanelSkeleton lines={3} />
      </div>
    </PageSkeleton>
  );
}
