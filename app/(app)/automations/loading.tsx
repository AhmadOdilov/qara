import { PageSkeleton, PanelSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton width="full">
      <Skeleton className="mb-4 ml-auto h-9 w-36" />
      <PanelSkeleton lines={6} />
      <div className="mt-4">
        <PanelSkeleton lines={4} />
      </div>
    </PageSkeleton>
  );
}
