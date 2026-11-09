// lib/mongodb.ts
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI as string;
const options = {};

let clientPromise: Promise<MongoClient>;

if (!uri) throw new Error("Please define MONGODB_URI in .env.local");

// Reuse one connection across dev hot reloads.
const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

if (process.env.NODE_ENV === "development") {
  if (!globalForMongo._mongoClientPromise) {
    globalForMongo._mongoClientPromise = new MongoClient(uri, options).connect();
  }
  clientPromise = globalForMongo._mongoClientPromise;
} else {
  clientPromise = new MongoClient(uri, options).connect();
}

/**
 * The database is the live production DB. Request-time writes (visitor log,
 * contact form) run only on the production deployment, or when
 * ALLOW_DB_WRITES=true is set on purpose, so local runs, preview deployments
 * and QA (Lighthouse, Playwright) never write to it.
 */
export function dbWritesEnabled(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.ALLOW_DB_WRITES === "true";
}

export default clientPromise;
