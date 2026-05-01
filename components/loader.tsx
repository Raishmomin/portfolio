"use client";

import { motion, AnimatePresence } from "framer-motion";

export function BrandLoader({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background"
        >
          <svg
            width="96"
            height="96"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground"
          >
            <motion.path
              d="M22 16h14a10 10 0 0 1 0 20h-2l8 12h-7l-8-12h-1v12h-4V16zm4 4v12h10a6 6 0 0 0 0-12H26z"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
            />
          </svg>
          <motion.div
            className="absolute bottom-16 text-xs uppercase tracking-[0.3em] text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Loading
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
