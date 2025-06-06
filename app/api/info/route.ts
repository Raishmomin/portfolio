import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const response = await fetch("https://ipapi.co/json/");

    if (response.ok) {
      const geoData = await response.json();
      const client = await clientPromise;
      const db = client.db("Portfolio");

      await db.collection("visitors").insertOne({
        ip: geoData.ip || null,
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
      return NextResponse.json(geoData);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch IP info" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error fetching or saving IP info:", error);
    return NextResponse.json(
      { error: "Failed to fetch or save IP info" },
      { status: 500 }
    );
  }
}
