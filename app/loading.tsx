export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-4">
        <span
          aria-hidden="true"
          className="h-8 w-8 rounded-full border-2 border-border border-t-foreground animate-spin"
        />
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}
