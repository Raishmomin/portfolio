"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
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
  const ref = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 20, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 20, mass: 0.4 });

  function handleMove(e: MouseEvent) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * strength);
    y.set((e.clientY - cy) * strength);
  }

  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  const sharedClass = cn(
    "relative inline-flex items-center justify-center select-none will-change-transform",
    className
  );
  const sharedStyle = { x: sx, y: sy };
  const tap = reduce ? undefined : { scale: 0.97 };

  if (as === "a") {
    return (
      <motion.a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={sharedStyle}
        whileTap={tap}
        aria-label={ariaLabel}
        className={sharedClass}
      >
        {children}
      </motion.a>
    );
  }

  if (as === "div") {
    return (
      <motion.div
        ref={ref as React.Ref<HTMLDivElement>}
        onClick={onClick}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={sharedStyle}
        whileTap={tap}
        aria-label={ariaLabel}
        className={sharedClass}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={sharedStyle}
      whileTap={tap}
      aria-label={ariaLabel}
      className={sharedClass}
    >
      {children}
    </motion.button>
  );
}
