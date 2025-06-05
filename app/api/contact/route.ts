// app/api/contact/route.ts
export const dynamic = 'force-dynamic';

import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Manual validation
    const errors: string[] = [];
    
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    
    if (!body.email || typeof body.email !== 'string' || !isValidEmail(body.email)) {
      errors.push('Valid email is required');
    }
    
    if (!body.subject || typeof body.subject !== 'string' || body.subject.trim().length < 2) {
      errors.push('Subject must be at least 2 characters');
    }
    
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length < 2) {
      errors.push('Message must be at least 2 characters');
    }
    
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Sanitize inputs
    const contactData = {
      name: sanitizeInput(body.name),
      email: sanitizeInput(body.email),
      subject: sanitizeInput(body.subject),
      message: sanitizeInput(body.message),
      createdAt: new Date(),
    };

    const client = await clientPromise;
    const db = client.db("Portfolio");

    const result = await db.collection("contact_data").insertOne(contactData);

    return NextResponse.json({ 
      success: true, 
      insertedId: result.insertedId 
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error("MongoDB POST Error:", error);
    return NextResponse.json(
      { error: "Failed to submit contact form" },
      { status: 500 }
    );
  }
}

// Helper functions
function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function sanitizeInput(input: string): string {
  // Basic sanitization - adjust as needed
  return input.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
}