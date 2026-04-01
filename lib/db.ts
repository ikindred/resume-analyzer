import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __resumeIqPool: Pool | undefined;
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error("DATABASE_URL is not configured");
  }
  return url;
}

export function getPool(): Pool {
  if (globalThis.__resumeIqPool) return globalThis.__resumeIqPool;

  const pool = new Pool({
    connectionString: getDatabaseUrl(),
  });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__resumeIqPool = pool;
  }

  return pool;
}

