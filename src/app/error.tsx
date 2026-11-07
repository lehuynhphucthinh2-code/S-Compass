"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** A calm fallback if one screen fails: the rest of the app and the saved demo data are not affected. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-bad/30 bg-bad-tint p-6 text-center" role="alert">
      <TriangleAlert className="mx-auto mb-2 size-8 text-bad" aria-hidden />
      <h1 className="text-lg font-semibold text-bad">This screen could not load</h1>
      <p className="mt-1 text-sm text-ink-soft">Your imported data and plans are kept in this browser. Try again, or go back to the Dispatcher. If it keeps happening, use “Reset demo” in the top bar.</p>
      <div className="mt-4 flex justify-center gap-2">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Link href="/dispatcher" className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium">
          Go to Dispatcher
        </Link>
      </div>
    </div>
  );
}
