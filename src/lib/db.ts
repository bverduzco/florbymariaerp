// src/lib/db.ts — v1.8: Database adapter with local + Turso support
//
// Detects the URL scheme and uses the appropriate adapter:
//   - libsql:// or https:// → @prisma/adapter-libsql (for Turso)
//   - file: → @prisma/adapter-better-sqlite3 (for local SQLite)
//
// This is the right approach because @prisma/adapter-libsql doesn't fully
// support local file: URLs (it has issues with the URL format).

import { PrismaClient } from "@prisma/client"

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

  // Decide which adapter to use based on the URL scheme.
  const isTurso = databaseUrl.startsWith("libsql://") ||
                  databaseUrl.startsWith("https://") ||
                  databaseUrl.startsWith("http://")
  const isLocalFile = databaseUrl.startsWith("file:")

  if (isTurso) {
    // Use @prisma/adapter-libsql for Turso (libsql over HTTP)
    const { PrismaLibSQL } = require("@prisma/adapter-libsql")
    const { createClient } = require("@libsql/client")
    const libsql = createClient({
      url: databaseUrl,
      // authToken is parsed from the URL's ?authToken= query string automatically
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }

  if (isLocalFile) {
    // Use @prisma/adapter-better-sqlite3 for local SQLite files
    // (libsql adapter has issues with file: URLs in some Prisma versions)
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3")
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl })
    return new PrismaClient({ adapter })
  }

  throw new Error(
    `Unsupported DATABASE_URL scheme: ${databaseUrl.split(":")[0]}. ` +
    "Use 'libsql://' for Turso or 'file:' for local SQLite."
  )
}

function getDb(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    return globalForPrisma.prisma
  }
  // In dev, always create fresh (easier debugging, no stale state)
  return createPrismaClient()
}

export const db = getDb()
