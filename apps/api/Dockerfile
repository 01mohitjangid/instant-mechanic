# ---------------------------------------------------------------------------
# Instant Mechanic API — production image
#
# Built from the REPO ROOT, not from apps/api, because this is an npm
# workspaces monorepo: the lockfile and the shared package both live above.
#
#   docker build -f apps/api/Dockerfile -t instant-mechanic-api .
#   docker run -p 4000:4000 --env-file apps/api/.env instant-mechanic-api
#
# Two stages: the first has the compilers and the dev dependencies, the second
# ships only what the server needs to run.
# ---------------------------------------------------------------------------

# --------------------------------------------------------------- build stage
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./

# The shared package's SOURCE is copied before the install, not just its
# manifest. npm runs a workspace's `prepare` hook during `npm ci` — and it does
# so even with --ignore-scripts — so the compiler needs its source to be there
# or the install fails with "command failed: tsc".
COPY packages/shared ./packages/shared

# Manifests only for the rest, so a code change does not invalidate this layer.
# Every workspace's package.json must be present or npm ci rejects the lockfile.
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN npm ci

COPY apps/api ./apps/api
RUN npm run build --workspace @instant-mechanic/api

# The dashboard workspace's manifest was only needed so npm ci would accept the
# lockfile. Removing it before pruning drops Next, React and Recharts from the
# tree — none of which the API server ever loads.
RUN rm -rf apps/web \
 && npm prune --omit=dev --ignore-scripts

# ------------------------------------------------------------ runtime stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# No install here at all: the dependency tree was already resolved and pruned
# upstream. Reinstalling would re-run the shared package's `prepare` hook with
# no compiler present.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# tsc emits JavaScript and nothing else, so the migration runner's .sql files
# have to be carried across by hand or `db:migrate` finds an empty directory.
COPY apps/api/src/db/migrations ./apps/api/dist/db/migrations

# Never run as root. The node image ships an unprivileged `node` user for this.
USER node

EXPOSE 4000

# /health hits the database, so this reports unhealthy when the container is up
# but cannot serve — which is the failure that actually matters.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]
