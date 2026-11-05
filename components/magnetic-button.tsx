"use client";

import type { ReactNode, MouseEvent } from "react";
import { cn } from "@/lib/utils";

type MagneticProps = {
  children: ReactNode;
  className?: string;
  strength?: number;
  as?: "button" | "a" | "div";
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  target?: string;
  rel?: string;
};

// Small magnetic CTA (design spec §2): a CSS `translate` driven by the pointer, no
// animation library. Skipped for coarse pointers, prefers-reduced-motion and when the
// header 3D/motion toggle is off (html[data-motion="off"]).
function motionAllowed() {
  return (
    document.documentElement.dataset.motion !== "off" &&
    matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches
  );
}

function onMove(strength: number) {
  return (e: MouseEvent<HTMLElement>) => {
    if (!motionAllowed()) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.translate = `${(e.clientX - r.left - r.width / 2) * strength}px ${(e.clientY - r.top - r.height / 2) * strength}px`;
  };
}

function onLeave(e: MouseEvent<HTMLElement>) {
  e.currentTarget.style.translate = "";
}

export function Magnetic({
  children,
  className,
  strength = 0.3,
  as = "button",
  href,
  onClick,
  ariaLabel,
  type = "button",
  disabled,
  target,
  rel,
}: MagneticProps) {
  const shared = {
    onClick,
    onMouseMove: onMove(strength),
    onMouseLeave: onLeave,
    "aria-label": ariaLabel,
    className: cn(
      "relative inline-flex items-center justify-center select-none transition-[translate,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100",
      className
    ),
  };

  if (as === "a") {
    return (
      <a href={href} target={target} rel={rel} {...shared}>
        {children}
      </a>
    );
  }
  if (as === "div") {
    return <div {...shared}>{children}</div>;
  }
  return (
    <button type={type} disabled={disabled} {...shared}>
      {children}
    </button>
  );
}
