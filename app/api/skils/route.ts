// app/api/data/route.ts
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("Portfolio");
    const collection1 = db.collection("skills");
    const collection2 = db.collection("experience");
    const collection3 = db.collection("projects");

    const data = {
      skils: await collection1.find({}).toArray(),
      experience: await collection2.find({}).toArray(),
      projects: await collection3.find({}).toArray(),
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
