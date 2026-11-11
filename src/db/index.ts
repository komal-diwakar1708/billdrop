import "server-only";
import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { DDL } from "./ddl";
import { seedDemo } from "./seed";

export type Db = NeonHttpDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __billdropDb?: Promise<Db>;
};

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  let db: Db;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    db = drizzle(neon(url), { schema });
  } else if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set. Add a Neon database in Vercel → Storage, then redeploy.",
    );
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = new PGlite(process.env.PGLITE_DIR ?? "./.pglite");
    db = drizzle(client, { schema }) as unknown as Db;
  }
  for (const statement of DDL) {
    await db.execute(sql.raw(statement));
  }
  try {
    await seedDemo(db);
  } catch (err) {
    console.error("Demo seed skipped:", err);
  }
  return db;
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__billdropDb) {
    globalForDb.__billdropDb = connect().catch((err) => {
      globalForDb.__billdropDb = undefined;
      throw err;
    });
  }
  return globalForDb.__billdropDb;
}

export { schema };
