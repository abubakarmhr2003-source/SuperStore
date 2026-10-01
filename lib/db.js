import { Pool } from "pg";

// A single shared connection pool to Supabase's Postgres database.
// Stored on `global` so Next.js's dev-mode hot-reload doesn't spawn a new
// pool (and a new DB connection) on every file change.
function getPool() {
  if (!global._gsPgPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env.local and fill in " +
        "your Supabase connection string."
      );
    }
    global._gsPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return global._gsPgPool;
}

export async function query(sql, params = []) {
  const pool = getPool();
  return pool.query(sql, params);
}

// Convenience: run a query and return just the rows array.
export async function rows(sql, params = []) {
  const res = await query(sql, params);
  return res.rows;
}

// Convenience: run a query and return just the first row (or null).
export async function row(sql, params = []) {
  const res = await query(sql, params);
  return res.rows[0] || null;
}
