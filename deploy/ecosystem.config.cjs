/**
 * PM2 process definition for the Instant Mechanic API.
 *
 * Start:    pm2 start deploy/ecosystem.config.cjs
 * Survive a reboot:  pm2 save && pm2 startup
 *
 * `cwd` matters: the API reads its .env with dotenv, which looks in the
 * current working directory. Started from the repo root instead, it boots
 * with no DATABASE_URL and exits.
 */
module.exports = {
  apps: [
    {
      name: 'instant-mechanic-api',
      cwd: './apps/api',
      script: 'dist/server.js',
      // One process, deliberately. Socket.IO clients would otherwise land on a
      // different worker than the one holding their connection, and a broadcast
      // would only reach a fraction of the dashboards. Scaling past one needs a
      // Redis adapter, not more workers.
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
      // Do not restart faster than the database can be reached.
      restart_delay: 3000,
      time: true,
    },
  ],
};
