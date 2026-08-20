import type { Metadata } from "next";
import { VocabApp } from "@/components/vocab/vocab-app";

export const metadata: Metadata = {
  title: "English Vocabulary Test",
  description:
    "100 ta Intermediate (B1–B2) inglizcha so'zni oltita xil savol turi bilan tekshiring: tarjima, kontekst, bo'sh joy to'ldirish, gap yozish va moslashtirish.",
};

export default function VocabPage() {
  return (
    <main className="min-h-dvh bg-surface-sunken px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            English Vocabulary Test
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Intermediate · B1–B2 · 100 words
          </p>
        </header>

        <VocabApp />
      </div>
    </main>
  );
}
