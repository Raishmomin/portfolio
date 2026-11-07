"use client";
// The city's wall-clock time, added after hydration next to the server-rendered time zone
// (the server never renders a time: it would be stale in the cached HTML). The contact
// globe shows the same "HH:MM IST" beside the city.
import { useEffect, useState } from "react";

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

export function LocalTime({ offsetMin, zone }: { offsetMin: number; zone: string }) {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => {
      const t = new Date(Date.now() + offsetMin * 60_000);
      setNow(`${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`);
    };
    tick();
    const id = window.setInterval(tick, 10_000);
    return () => window.clearInterval(id);
  }, [offsetMin]);
  return (
    <span className="js-only inline-block min-w-[9ch] tabular-nums text-muted-foreground">
      {now ? (
        <>
          · <time>{now}</time> {zone} now
        </>
      ) : null}
    </span>
  );
}
