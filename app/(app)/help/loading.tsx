import { PageSkeleton, PanelSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton width="narrow">
      <div className="space-y-4">
        <PanelSkeleton lines={5} />
        <PanelSkeleton lines={6} />
      </div>
    </PageSkeleton>
  );
}
