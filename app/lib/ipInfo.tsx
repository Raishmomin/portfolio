export async function fetchIPInfo() {
  try {
    await fetch("/api/info", { method: "POST" });
  } catch {
    // fire-and-forget analytics — never surface errors to the console
  }
}
