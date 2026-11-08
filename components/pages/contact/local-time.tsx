"use client";
// The city's wall-clock time, added after hydration next to the server-rendered time zone
// (the server never renders a time: it would be stale in the cached HTML). The contact
// globe shows the same "HH:MM IST" beside the city; both change on the minute boundary
// (the globe reads the clock each frame, this ticks at :00), so they never disagree.
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/** "14:26 now" (`sep`: "· 14:26 now", for an inline row). Renders nothing until hydrated. */
export function LocalTime({ offsetMin, sep = false, className }: { offsetMin: number; sep?: boolean; className?: string }) {
  const [now, setNow] = useState("");
  useEffect(() => {
    let interval = 0;
    const tick = () => {
      const t = new Date(Date.now() + offsetMin * 60_000);
      setNow(`${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`);
    };
    tick();
    // Align to the next minute boundary, then tick once a minute.
    const timeout = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000) + 20);
    // Background tabs throttle timers: catch up when the tab is shown again.
    const onShow = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [offsetMin]);
  return (
    <span className={cn("js-only tabular-nums text-muted-foreground", className)}>
      {now ? (
        <>
          {sep ? "· " : ""}
          <time>{now}</time> now
        </>
      ) : null}
    </span>
  );
}
