import { query } from '../db/pool.js';

export interface HealthReport {
  status: 'ok';
  database: 'reachable';
  databaseLatencyMs: number;
  uptimeSeconds: number;
  timestamp: string;
}

/**
 * Liveness plus a real database round trip.
 *
 * A health check that only proves the process is running is close to useless.
 * This one throws when the database is unreachable, which is the failure that
 * actually takes the dashboard down — and the thrown error becomes a 500, so an
 * uptime monitor sees it.
 */
export async function getHealth(): Promise<HealthReport> {
  const startedAt = Date.now();
  await query('SELECT 1');

  return {
    status: 'ok',
    database: 'reachable',
    databaseLatencyMs: Date.now() - startedAt,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
