"use client";

import { useEffect } from "react";
import { fetchIPInfo } from "@/lib/ipInfo";

/** Fire-and-forget visit ping once the browser is idle (home page only). Renders nothing. */
export function VisitBeacon() {
  useEffect(() => {
    const idle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (window as unknown as { requestIdleCallback: (cb: () => void) => void })
            .requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 600);
    idle(() => fetchIPInfo());
  }, []);

  return null;
}
