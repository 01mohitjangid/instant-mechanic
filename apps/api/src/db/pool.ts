/**
 * One shared PostgreSQL connection pool for the whole process.
 *
 * Neon is a serverless Postgres, so we talk to its pooled endpoint over TLS and
 * keep the pool small — many short-lived connections cost more than they save.
 */
import { Pool } from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env.js';

/**
 * `sslmode` / `channel_binding` in the URL are dropped because TLS is configured
 * explicitly below. Leaving them in makes node-postgres print a deprecation
 * warning on every run, and two sources of truth for TLS is one too many.
 */
function stripSslParams(connectionString: string): string {
  const queryStart = connectionString.indexOf('?');
  if (queryStart === -1) return connectionString;

  const base = connectionString.slice(0, queryStart);
  const kept = connectionString
    .slice(queryStart + 1)
    .split('&')
    .filter((part) => !/^(sslmode|channel_binding)=/i.test(part));

  return kept.length > 0 ? `${base}?${kept.join('&')}` : base;
}

/**
 * A local Postgres normally has no TLS at all, so forcing it there fails with
 * "the server does not support SSL connections". Everything else — Neon, RDS —
 * gets a properly verified certificate.
 */
function requiresTls(connectionString: string): boolean {
  let hostname: string;
  try {
    // Parsed rather than pattern-matched: a regex silently misses the two forms
    // local development actually uses — a bracketed IPv6 host (@[::1]:5432) and
    // a credential-less URL (postgresql://localhost/db, which has no "@" at
    // all) — and would then force TLS exactly where it must not be forced.
    // postgresql: is a non-special URL scheme, so the parser does NOT lowercase
    // the host — "LOCALHOST" would stay uppercase and miss the comparison below.
    hostname = new URL(connectionString).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    // Unparseable: keep TLS on. Failing closed is the safe direction.
    return true;
  }
  return !['localhost', '127.0.0.1', '::1'].includes(hostname);
}

export const pool = new Pool({
  connectionString: stripSslParams(env.DATABASE_URL),
  ssl: requiresTls(env.DATABASE_URL) ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Generous, because a Neon compute that has scaled to zero needs a moment to
  // wake up before it will accept the first connection.
  connectionTimeoutMillis: 20_000,
});

pool.on('error', (error) => {
  console.error('[db] idle client error:', error.message);
});

/** Run a single parameterised query. Never build SQL by string concatenation. */
export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

/**
 * Run several statements inside one transaction.
 * The client is always released, even when the callback throws.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
