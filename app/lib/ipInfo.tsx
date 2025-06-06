export async function fetchIPInfo() {
  try {
    const res: any = await fetch("/api/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to fetch IP info");
    if (res?.ok) {
      const data = await res.json();
    }
  } catch (err) {
    console.error(err);
  } finally {
  }
}
