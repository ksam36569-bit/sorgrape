#!/usr/bin/env node
/**
 * Applies pending SQL migrations at deploy time.
 *
 * Why this exists: the database was the one part of a release that a human had
 * to perform by hand, in a dashboard, in the right order. That is the step most
 * likely to be forgotten or done twice. Running it from the build means a push
 * is the whole release — schema, data and app together.
 *
 * Behaviour:
 *   - Applies files in supabase/migrations in filename order.
 *   - Records each one in schema_migrations, so re-running is a no-op.
 *   - Takes a Postgres advisory lock, so two concurrent builds cannot both
 *     apply the same migration.
 *   - Each migration runs in its own transaction: a failure rolls back rather
 *     than leaving the schema half-changed.
 *   - With no SUPABASE_DB_URL set it skips and exits 0, so a preview build or a
 *     fork without database access still deploys.
 */
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, "..", "supabase", "migrations");
// Any 64-bit constant; it only has to be the same across builds of this project.
const LOCK_KEY = 8127346501982n;

/**
 * @param {object} opts
 * @param {string}  opts.url        Postgres connection string
 * @param {string}  opts.dir        directory of .sql migrations
 * @param {object}  opts.driver     pg-compatible driver (injectable for tests)
 * @returns {Promise<number>} process exit code
 */
export async function migrate({ url = process.env.SUPABASE_DB_URL, dir = MIGRATIONS, driver = pg } = {}) {
  if (!url) {
    console.log("[migrate] SUPABASE_DB_URL is not set — skipping migrations.");
    console.log("[migrate] Set it in Vercel to have schema changes apply on deploy.");
    return 0;
  }

  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  if (!files.length) {
    console.log("[migrate] No migrations found.");
    return 0;
  }

  const client = new driver.Client({
  connectionString: url,
  // Supabase terminates unencrypted connections; its certificate chain is not
  // in the build image's trust store, so verification is relaxed rather than
  // encryption disabled.
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

  let exitCode = 0;
    try {
    await client.connect();
    await client.query(`
      create table if not exists public.schema_migrations (
        filename    text primary key,
        applied_at  timestamptz not null default now()
      )
    `);

    await client.query("select pg_advisory_lock($1)", [String(LOCK_KEY)]);

    const { rows } = await client.query("select filename from public.schema_migrations");
    const done = new Set(rows.map((r) => r.filename));

    let applied = 0;
    for (const file of files) {
      if (done.has(file)) {
        console.log(`[migrate] skip ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(dir, file), "utf8");
      console.log(`[migrate] applying ${file} …`);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into public.schema_migrations (filename) values ($1)", [file]);
        await client.query("commit");
        applied += 1;
        console.log(`[migrate] applied ${file}`);
      } catch (err) {
        await client.query("rollback").catch(() => {});
        console.error(`[migrate] FAILED ${file}: ${err.message}`);
        throw err;
      }
    }

    console.log(
      applied ? `[migrate] done — ${applied} migration(s) applied.` : "[migrate] done — database already up to date."
    );
  } catch (err) {
    console.error("[migrate] " + (err?.message || err));
    exitCode = 1;
  } finally {
    await client.query("select pg_advisory_unlock($1)", [String(LOCK_KEY)]).catch(() => {});
    await client.end().catch(() => {});
  }

  return exitCode;
}

// CLI entry point — only when run directly, so tests can import migrate().
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await migrate());
}
