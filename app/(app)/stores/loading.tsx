import { PageSkeleton, CardGridSkeleton, PanelSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton width="wide">
      <Skeleton className="mb-6 h-10 w-full max-w-2xl" />
      <div className="mb-6">
        <PanelSkeleton lines={4} />
      </div>
      <CardGridSkeleton count={2} />
    </PageSkeleton>
  );
}
