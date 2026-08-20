import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {/* Stepper — uch qadam, haqiqiy oqim bilan bir xil joyda */}
          <Skeleton className="h-11 w-full" />
          <Skeleton className="mt-8 h-7 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-8 h-32 w-full" />
          <Skeleton className="mt-4 h-11 w-40" />
        </div>
      </div>
    </div>
  );
}
