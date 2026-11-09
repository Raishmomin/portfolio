import clientPromise, { dbWritesEnabled } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

function getVisitorIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

type GeoData = {
  ip?: string;
  city?: string;
  region?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
  org?: string;
  timezone?: string;
};

export async function POST(request: NextRequest) {
  // Outside production (local, preview, QA) the visit is not logged: the DB is live.
  if (!dbWritesEnabled()) return NextResponse.json({ ok: true, skipped: true });

  try {
    const ip = getVisitorIp(request);

    // Geo lookup of the visitor's IP (not the server's). Best-effort — a
    // failed lookup still records the visit with whatever we have.
    let geoData: GeoData = {};
    if (ip) {
      try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`, {
          headers: { "User-Agent": "raish-momin-portfolio/1.0" },
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) geoData = (await response.json()) as GeoData;
      } catch {
        // ignore lookup failures — still log the raw IP below
      }
    }

    const client = await clientPromise;
    const db = client.db("Portfolio");

    await db.collection("visitors").insertOne({
      ip: geoData.ip || ip || null,
      city: geoData.city || null,
      region: geoData.region || null,
      country: geoData.country_name || null,
      location:
        geoData.latitude && geoData.longitude
          ? `${geoData.latitude},${geoData.longitude}`
          : null,
      org: geoData.org || null,
      timezone: geoData.timezone || null,
      timestamp: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving visitor info:", error);
    // Analytics endpoint — never surface an error status to the client
    return NextResponse.json({ ok: false });
  }
}
