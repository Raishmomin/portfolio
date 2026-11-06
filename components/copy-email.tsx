"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cx } from "@/lib/cx";

/**
 * "Copy email" island (hero, home contact, /contact): copies the server-provided
 * address and confirms "Copied ✓" in a polite live region. Falls back to
 * select-and-copy where the Clipboard API is unavailable. `js-only`: hidden without
 * JS, where it could do nothing (the mailto link next to it still works).
 */
export function CopyEmail({ email, icon = false, className }: { email: string; icon?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

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
      const ok = document.execCommand("copy");
      t.remove();
      if (!ok) return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cx(
        "js-only inline-flex min-h-11 min-w-[8.5rem] items-center justify-center gap-2 rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-foreground/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {icon ? (
        copied ? <Check aria-hidden="true" className="h-4 w-4 text-ok" /> : <Copy aria-hidden="true" className="h-4 w-4" />
      ) : null}
      <span aria-live="polite">{copied ? "Copied ✓" : "Copy email"}</span>
    </button>
  );
}
