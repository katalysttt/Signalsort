// Persistence layer.
// - DATABASE_URL set   -> hosted Postgres (e.g. Supabase) via `pg`.
// - DATABASE_URL empty -> embedded Postgres (PGlite) persisted to ./data/pg.
// Both speak the same SQL dialect, so the rest of the app is storage-agnostic.
import path from "node:path";
import fs from "node:fs";

type Row = Record<string, any>;
interface Driver {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  kind: "postgres" | "pglite";
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS data_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  item_count INTEGER NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id INTEGER REFERENCES data_sources(id) ON DELETE CASCADE,
  author TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  analysis JSONB,
  sentiment TEXT,
  category TEXT,
  priority TEXT,
  analyzed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS feedback_sentiment_idx ON feedback(sentiment);
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'api',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_user_idx ON events(user_id, ts);
CREATE TABLE IF NOT EXISTS analysis_runs (
  id SERIAL PRIMARY KEY,
  engine TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS recommendations (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed',
  status_note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  run_id INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
`;

async function createDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    });
    return {
      kind: "postgres",
      async query(sql, params = []) {
        const r = await pool.query(sql, params as any[]);
        return r.rows;
      },
      async exec(sql) {
        await pool.query(sql);
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), "data", "pg");
  fs.mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir);
  await pg.waitReady;
  return {
    kind: "pglite",
    async query(sql, params = []) {
      const r = await pg.query(sql, params as any[]);
      return r.rows as any[];
    },
    async exec(sql) {
      await pg.exec(sql);
    },
  };
}

const g = globalThis as unknown as { __signalsortDb?: Promise<Driver> };

export function db(): Promise<Driver> {
  if (!g.__signalsortDb) {
    g.__signalsortDb = (async () => {
      const d = await createDriver();
      await d.exec(SCHEMA);
      return d;
    })().catch((e) => {
      g.__signalsortDb = undefined;
      throw e;
    });
  }
  return g.__signalsortDb;
}

export async function q<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db()).query<T>(sql, params);
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const rows = await q<{ value: T }>("SELECT value FROM settings WHERE key = $1", [key]);
  return rows[0]?.value ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await q(
    "INSERT INTO settings(key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [key, JSON.stringify(value)],
  );
}
