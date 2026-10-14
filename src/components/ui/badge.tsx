import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5", {
  variants: {
    tone: {
      neutral: "bg-canvas text-ink-soft ring-1 ring-line",
      brand: "bg-brand-tint text-brand-ink",
      ok: "bg-ok-tint text-ok",
      warn: "bg-warn-tint text-warn",
      bad: "bg-bad-tint text-bad",
      info: "bg-info-tint text-info",
      dark: "bg-ink text-white",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
