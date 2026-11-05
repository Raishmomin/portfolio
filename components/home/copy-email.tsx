"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** "Copy email" island: copies, then confirms "Copied ✓" in a polite live region. */
export function CopyEmail({ email, className }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Clipboard API unavailable (insecure context / denied): select-and-copy fallback.
      const t = document.createElement("textarea");
      t.value = email;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex min-h-11 min-w-[8.5rem] items-center justify-center gap-2 rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-foreground/40 hover:bg-accent",
        className,
      )}
    >
      <span aria-live="polite">{copied ? "Copied ✓" : "Copy email"}</span>
    </button>
  );
}
