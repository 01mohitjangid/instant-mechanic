/**
 * Minimal forward-only migration runner.
 *
 * Every `.sql` file in ./migrations runs once, in filename order, inside its own
 * transaction. Applied filenames are recorded in `schema_migrations`, so running
 * this twice is safe and does nothing the second time.
 *
 *   npm run db:migrate            apply anything not yet applied
 *   npm run db:migrate -- --reset  drop everything first, then apply from scratch
 *
 * `--reset` exists because during development the initial schema keeps changing,
 * and one clean migration file reads better than a trail of patch migrations.
 * It refuses to run when NODE_ENV=production, and prints the host it is about to
 * wipe — note that this is an environment check, not a "is this database live"
 * check, so read the printed host before answering for it.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { closePool, query, withTransaction } from './pool.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations(): Promise<Set<string>> {
  const { rows } = await query<{ filename: string }>('SELECT filename FROM schema_migrations');
  return new Set(rows.map((row) => row.filename));
}

async function resetSchema(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to drop the schema while NODE_ENV=production');
  }
  let host = 'unknown host';
  try {
    host = new URL(env.DATABASE_URL).host;
  } catch {
    // Leave the placeholder; env validation already proved the URL is usable.
  }

  console.log(`  reset  dropping and recreating schema "public" on ${host}`);
  // One transaction: a failure between the two statements would otherwise leave
  // the database with no public schema at all.
  await withTransaction(async (client) => {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  });
}

async function run(): Promise<void> {
  if (process.argv.includes('--reset')) {
    await resetSchema();
  }

  await ensureMigrationsTable();
  const applied = await appliedMigrations();

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip   ${file} (already applied)`);
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const startedAt = Date.now();

    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    });

    ran += 1;
    console.log(`  apply  ${file} (${Date.now() - startedAt}ms)`);
  }

  console.log(ran === 0 ? '\nDatabase already up to date.' : `\nApplied ${ran} migration(s).`);
}

run()
  .catch((error: unknown) => {
    console.error('\nMigration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closePool().catch(() => undefined);
  });
