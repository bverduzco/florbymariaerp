// src/lib/db.ts — v1.8: Turso adapter setup
//
// Replaces the v1.7 PrismaClient singleton with one that uses the libsql
// driver adapter (so it can talk to Turso over HTTP).
//
// v1.7 used:
//   const db = new PrismaClient()
//
// v1.8 uses:
//   const libsql = createClient({ url: process.env.DATABASE_URL, authToken: ... })
//   const adapter = new PrismaLibSQL(libsql)
//   const db = new PrismaClient({ adapter })
//
// On localhost, you can still use a local SQLite file by setting:
//   DATABASE_URL=file:./db/custom.db
// (the libsql client supports the `file:` URL scheme)

import { PrismaClient } from "@prisma/client"
import { PrismaLibSQL } from "@prisma/adapter-libsql"
import { createClient } from "@libsql/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL env var is required. " +
      "For Turso: libsql://<your-db>.turso.io?authToken=<token>. " +
      "For local SQLite: file:./db/custom.db"
    )
  }

  // Parse authToken from the URL query string if present.
  // Turso connection strings look like:
  //   libsql://florbymaria-xxx.turso.io?authToken=eyJ...
  // The libsql client accepts the URL as-is and extracts the token internally,
  // so we don't need to do anything special.
  const libsql = createClient({
    url: databaseUrl,
    // If authToken is in the URL, libsql/client picks it up automatically.
    // If you want to pass it separately for clarity, uncomment:
    // authToken: process.env.TURSO_AUTH_TOKEN,
  })

  const adapter = new PrismaLibSQL(libsql)
  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

// In development, cache the Prisma client on the global object to prevent
// exhausting DB connections on hot reloads. In production, each serverless
// function invocation gets its own PrismaClient (Vercel handles this fine).
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
