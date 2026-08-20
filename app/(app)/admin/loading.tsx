import { PageSkeleton, StatRowSkeleton, PanelSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton width="full">
      <StatRowSkeleton />
      <div className="space-y-4">
        <PanelSkeleton lines={8} />
        <PanelSkeleton lines={6} />
      </div>
    </PageSkeleton>
  );
}
