import "server-only";
import { migrate } from "./migrations";
import { logWarn } from "./log";

/**
 * One tiny query interface over two Postgres backends:
 *  - production (Railway): `pg` Pool from DATABASE_URL
 *  - local dev without DATABASE_URL: PGlite (real Postgres in WASM) under .data/pglite
 * Schema changes are versioned in ./migrations and applied on first use.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}



/**
 * One connection per process, kept on globalThis. Next.js evaluates pages and route handlers as separate module
 * instances (and dev HMR re-evaluates them), so a module-level variable would open several PGlite instances on the
 * same folder, each blind to the others' writes. A shared global makes every caller use the same database object.
 */
const g = globalThis as typeof globalThis & { __bpmDb?: Promise<Db> | null };

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  let db: Db;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    // An idle connection the database dropped (maintenance, a network reset) emits "error" on the pool; without a listener Node
    // treats it as unhandled and ends the whole process. The pool discards the client and connects again on the next query.
    pool.on("error", (e) => logWarn(`database pool: idle connection error ${e.name}`));
    db = { query: async (sql, params) => (await pool.query(sql, params as unknown[])).rows };
  } else if (process.env.NODE_ENV === "production" && !process.env.PGLITE_DIR) {
    throw new Error("DATABASE_URL is required in production");
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    // PGlite creates only the last path segment, so a fresh checkout without .data/ would fail.
    const dir = process.env.PGLITE_DIR ?? ".data/pglite";
    (await import("node:fs")).mkdirSync(dir, { recursive: true });
    const pg = new PGlite(dir);
    db = { query: async (sql, params) => (await pg.query(sql, params as unknown[])).rows as never };
    await migrate((sql) => pg.exec(sql));
    return db;
  }
  // pg: multi-statement DDL goes through the simple-query protocol (no params).
  await migrate((sql) => db.query(sql));
  return db;
}

export function getDb(): Promise<Db> {
  g.__bpmDb ??= open().catch((e) => {
    g.__bpmDb = null;
    throw e;
  });
  return g.__bpmDb;
}
