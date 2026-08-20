import { CardSkeleton, Skeleton } from "@/components/ui";

/**
 * Route darajasidagi yuklanish holati (§25).
 *
 * Uchta qoida:
 *   · Skelet HAQIQIY sahifa bilan bir xil karkasda turadi — bir xil
 *     `max-w`, bir xil padding, bir xil sarlavha balandligi. Shuning uchun
 *     kontent kelganda hech narsa sakramaydi (CLS ≈ 0).
 *   · Spinner ishlatilmaydi: aylanayotgan doira nima yuklanayotganini
 *     aytmaydi, skelet esa aytadi.
 *   · Matn yozilmaydi — «Yuklanmoqda…» uch tilga tarjima talab qiladi va
 *     bir soniyada g'oyib bo'ladigan satr uchun bu ortiqcha.
 */

type Width = "narrow" | "wide" | "full";

const MAX_WIDTH: Record<Width, string> = {
  narrow: "max-w-3xl",
  wide: "max-w-4xl",
  full: "max-w-6xl",
};

export function PageSkeleton({
  width = "wide",
  children,
}: {
  width?: Width;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={`mx-auto ${MAX_WIDTH[width]} px-4 py-8 sm:px-6`}>
        {/* PageHeading bilan bir xil o'lcham: h1 20px + subtitle 14px + mb-6 */}
        <div className="mb-6 space-y-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Bot/do'kon kartalari uchun panjara. */
export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Ko'rsatkich kartalari qatori. */
export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-card border border-line bg-surface-raised p-4"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2.5 h-7 w-14" />
        </div>
      ))}
    </div>
  );
}

/** Bitta katta blok — jadval, grafik yoki forma o'rniga. */
export function PanelSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="rounded-card border border-line bg-surface-raised p-5">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className="h-3.5 w-full" />
        ))}
      </div>
    </div>
  );
}
