import { Skeleton } from "@/components/ui";

/** Tariflar sahifasi — sarlavha bo'limi va beshta karta o'z joyida turadi. */
export default function Loading() {
  return (
    <main className="pb-20">
      <section className="border-b border-line bg-surface-sunken py-14 sm:py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 sm:px-6">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-6 w-80" />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="rounded-card border border-line bg-surface-raised p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
              <Skeleton className="mt-5 h-8 w-28" />
              <div className="mt-5 space-y-2">
                {Array.from({ length: 5 }, (_, j) => (
                  <Skeleton key={j} className="h-3 w-full" />
                ))}
              </div>
              <Skeleton className="mt-5 h-10 w-full" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
