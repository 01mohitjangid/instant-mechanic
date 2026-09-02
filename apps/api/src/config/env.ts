/**
 * Single place where environment variables enter the application.
 *
 * Everything else imports typed values from here. Nothing else in the codebase
 * reads `process.env` directly, so a missing or malformed variable fails loudly
 * at boot instead of silently at 2am.
 */
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'DATABASE_URL must be a PostgreSQL connection string'
    ),
  PORT: z.coerce.number().int().positive().default(4000),
  /**
   * The timezone the operations team works in. "Today's bookings" means today
   * in this zone, not in whatever timezone the server happens to run in — the
   * API will run on AWS in UTC while the team sits in India.
   */
  APP_TIMEZONE: z.string().min(1).default('Asia/Kolkata'),
  /**
   * Comma-separated list of browser origins allowed to call this API, or "*"
   * to allow any. The dashboard runs on a different host to the API, so this
   * has to be explicit — a wrong value shows up as a CORS error in the browser
   * and nothing at all in the server log.
   */
  CORS_ORIGINS: z.string().min(1).default('*'),
  /** Requests allowed per IP per window, and the window length in minutes. */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(1),
  /**
   * How many reverse proxies sit in front of this API. "false" (the default)
   * means none.
   *
   * This must not be switched on blindly: with `trust proxy` enabled and no
   * real proxy in front, Express believes a client-supplied X-Forwarded-For,
   * and anyone can walk past the rate limiter by rotating that header. Set it
   * to 1 only where something like an AWS load balancer really is in front.
   */
  TRUST_PROXY: z.string().default('false'),
  /**
   * Whether to run the booking simulator.
   *
   * Nobody is actually driving to a customer, so without this the live
   * dashboard has nothing to show. It walks real bookings along the real
   * lifecycle through the same service the API uses — it does not fake events.
   * Turn it off in any environment where the data must stay still.
   */
  SIMULATOR_ENABLED: z.enum(['true', 'false']).default('true'),
  /** Milliseconds between simulated status changes. */
  SIMULATOR_INTERVAL_MS: z.coerce.number().int().min(1000).max(600_000).default(6000),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  // Trim, because a pasted connection string often carries stray whitespace.
  DATABASE_URL: process.env.DATABASE_URL?.trim(),
  PORT: process.env.PORT,
  APP_TIMEZONE: process.env.APP_TIMEZONE,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MINUTES: process.env.RATE_LIMIT_WINDOW_MINUTES,
  TRUST_PROXY: process.env.TRUST_PROXY,
  SIMULATOR_ENABLED: process.env.SIMULATOR_ENABLED,
  SIMULATOR_INTERVAL_MS: process.env.SIMULATOR_INTERVAL_MS,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}\n`);
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';

export const simulatorEnabled = env.SIMULATOR_ENABLED === 'true';

/** `false` | `true` | a hop count. Anything unrecognised falls back to `false`. */
export const trustProxy: boolean | number = (() => {
  const raw = env.TRUST_PROXY.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === '' || raw === 'false') return false;
  const hops = Number(raw);
  return Number.isInteger(hops) && hops >= 0 ? hops : false;
})();

/** `*` stays a wildcard; anything else becomes an explicit allow-list. */
export const corsOrigins: '*' | string[] =
  env.CORS_ORIGINS.trim() === '*'
    ? '*'
    : env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
