export const dynamic = "force-dynamic";

import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db("Portfolio");
        const posts = await db
            .collection("blogs")
            .find({})
            .sort({ publishedAt: -1 })
            .toArray();

        return NextResponse.json({ posts });
    } catch (error) {
        console.error("Blogs GET Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch blogs" },
            { status: 500 }
        );
    }
}
