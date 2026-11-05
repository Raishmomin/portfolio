"use client";

import { useSyncExternalStore } from "react";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(id);
}
const getSnapshot = () => fmt.format(new Date());
const getServerSnapshot = () => "";

/**
 * Current time in IST. The server renders an empty fixed-width tabular-nums slot
 * (no layout shift); the client fills in HH:MM after hydration.
 */
export function LocalTime() {
  const time = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <span className="inline-block w-[9ch] whitespace-nowrap tabular-nums">
      {time ? (
        <>
          <span aria-hidden="true">· </span>
          <time dateTime={time}>{time}</time>
        </>
      ) : null}
    </span>
  );
}
