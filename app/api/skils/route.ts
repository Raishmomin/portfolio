import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { PROFILE, LOCATION_LABEL, experienceLabel } from "@/lib/profile";

// Legacy endpoint: the site no longer calls it (pages render on the server), but it
// keeps responding in its old shape. Identity facts are overridden from profile.ts so
// it never contradicts the rest of the site (raw DB: "Ahemadabad", utm'd LinkedIn).
const identity = () => ({
  experience: experienceLabel(),
  email: PROFILE.email,
  location: LOCATION_LABEL,
  git_hub: PROFILE.social.github,
  linkdin: PROFILE.social.linkedin,
});

export async function POST() {
  try {
    const client = await clientPromise;
    const db = client.db("Portfolio");
    const collection1 = db.collection("skills");
    const collection2 = db.collection("experience");
    const collection3 = db.collection("projects");
    const collection4 = db.collection("personal-data");

    const data = {
      skils: await collection1.find({}).toArray(),
      experience: await collection2.find({}).toArray(),
      projects: await collection3.find({}).sort({ sort: -1 }).collation({ locale: "en_US", numericOrdering: true }).toArray(),
      personalData: (await collection4.find({}).toArray()).map((doc) => ({ ...doc, ...identity() })),
    };
    // Convert MongoDB documents to JSON
    return NextResponse.json(data);
  } catch (error) {
    console.error("MongoDB Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
