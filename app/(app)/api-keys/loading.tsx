import { PageSkeleton, PanelSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton width="wide">
      <PanelSkeleton lines={5} />
    </PageSkeleton>
  );
}
