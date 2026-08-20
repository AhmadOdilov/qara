import { PageSkeleton, PanelSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton width="full">
      <Skeleton className="mb-4 h-9 w-64" />
      <div className="space-y-4">
        <PanelSkeleton lines={4} />
        <PanelSkeleton lines={6} />
      </div>
    </PageSkeleton>
  );
}
