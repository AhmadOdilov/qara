import { PageSkeleton, PanelSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton width="narrow">
      <div className="space-y-4">
        <PanelSkeleton lines={2} />
        <PanelSkeleton lines={3} />
        <PanelSkeleton lines={4} />
        <PanelSkeleton lines={5} />
      </div>
    </PageSkeleton>
  );
}
