import { PageSkeleton, CardGridSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <PageSkeleton width="wide">
      {/* Qidiruv va filtr qatori — ro'yxat sahifasidagi bilan bir xil balandlik */}
      <Skeleton className="mb-4 h-10 w-full" />
      <CardGridSkeleton count={6} />
    </PageSkeleton>
  );
}
