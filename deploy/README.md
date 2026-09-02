# Deploying Instant Mechanic

The app deploys to **two** places, and they are joined by one setting.

```
Browser
 ↓
Vercel            → the dashboard (apps/web)
 ↓
Nginx on EC2      → https + wss
 ↓
Node API          → apps/api, port 4000
 ↓
Neon PostgreSQL   → already hosted, nothing to do
```

The API must run on an always-on machine. It holds open WebSocket connections
and runs a timer, so Lambda, Vercel functions and anything else that sleeps
between requests cannot host it.

---

## Part 1 — The API on AWS EC2

### 1. Launch the machine

- EC2 → Launch instance → **Ubuntu 24.04**, type **t3.small**.
- Create a key pair and download the `.pem` file.
- Security group inbound rules: **22** (SSH), **80** (http), **443** (https).
- Do **not** open port 4000. Nginx reaches it locally.

### 2. Connect

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### 3. Install what the server needs

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
sudo npm install -g pm2
node -v          # expect v20 or newer
```

### 4. Get the code and build it

```bash
git clone https://github.com/01mohitjangid/instant-mechanic.git
cd instant-mechanic
npm ci                                         # also builds packages/shared
npm run build --workspace @instant-mechanic/api
```

`npm ci` must run with dev dependencies, because TypeScript is what does the
build. Do not add `--omit=dev`.

### 5. Write the production environment

```bash
nano apps/api/.env
```

```ini
DATABASE_URL="postgresql://...@...neon.tech/neondb?sslmode=require"
PORT=4000
NODE_ENV=production
APP_TIMEZONE=Asia/Kolkata

# The dashboard's real URL. A wrong value shows as a CORS error in the
# browser and nothing at all in the server log.
CORS_ORIGINS=https://your-dashboard.vercel.app

# Nginx is one proxy in front. Required for the rate limiter to see the
# real client IP — and dangerous to switch on when nothing is in front.
TRUST_PROXY=1

RATE_LIMIT_MAX=300
RATE_LIMIT_WINDOW_MINUTES=1

SIMULATOR_ENABLED=true
SIMULATOR_INTERVAL_MS=60000
```

This file is gitignored and never leaves the server.

### 6. Prepare the database (first deploy only)

```bash
npm run db:migrate
npm run db:seed
npm run db:verify        # every check must pass
```

### 7. Start the API and keep it running

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup              # run the command it prints back
pm2 logs instant-mechanic-api
curl localhost:4000/health
```

### 8. Point a domain at the machine

In your DNS provider, add an **A record**:

| Name  | Type | Value              |
| ----- | ---- | ------------------ |
| `api` | A    | your EC2 public IP |

### 9. Put Nginx in front

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/instant-mechanic
sudo nano /etc/nginx/sites-available/instant-mechanic     # set server_name
sudo ln -s /etc/nginx/sites-available/instant-mechanic /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
curl http://api.yourdomain.com/health
```

The three `Upgrade` lines in that config are what let the WebSocket connect.
Without them nothing errors — the dashboard just falls back to polling.

### 10. Add HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

`wss://` then works automatically. There is no separate WebSocket certificate.

---

## Part 2 — The dashboard on Vercel

1. Import the GitHub repo at vercel.com.
2. Set **Root Directory** to `apps/web`. Without this the build cannot find the app.
3. Add an environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://api.yourdomain.com`
4. Deploy.
5. Copy the deployed URL back into `CORS_ORIGINS` on the server, then
   `pm2 restart instant-mechanic-api`.

---

## Checking it actually works

- Open the dashboard. The dot in the top bar should read **Live** and pulse green.
- **Polling** instead means the WebSocket did not connect — re-check step 9.
- A red error panel means the API is unreachable — check `CORS_ORIGINS` and `pm2 logs`.

## Shipping a change later

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
cd instant-mechanic
git pull
npm ci
npm run build --workspace @instant-mechanic/api
pm2 restart instant-mechanic-api
```

Vercel redeploys the dashboard on its own when you push to `main`.

## If AWS is too much right now

Render, Railway and Fly.io do steps 1–10 in a few clicks, with WebSocket
support and HTTPS by default. Point `NEXT_PUBLIC_API_URL` at whichever host you
choose — no application code changes either way.
