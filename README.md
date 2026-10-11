# Lofi Haven
No accounts. Open the site, create a room, copy the link, study together.

## Run locally (Windows, Node 18+)
    npm install
    npm run api      # terminal 1: local room server (wrangler dev, port 8787)
    npm run dev      # terminal 2: app at http://localhost:5173 (use the Network URL on your phone)

## Calls
Public meet.jit.si is test-only for embedding (5-minute cap, no anonymous embeds). Choose one:
1. JaaS free tier (https://jaas.8x8.vc): create an app + API key, copy `.dev.vars.example` to `.dev.vars`.
   Your private key must be PKCS#8 ("BEGIN PRIVATE KEY"); if it says "BEGIN RSA PRIVATE KEY":
   `openssl pkcs8 -topk8 -nocrypt -in key.pk -out key.pk8`
2. Self-hosted Jitsi: set `JITSI_DOMAIN` in wrangler.toml.
Camera/mic/screen share need https or localhost.

## Deploy (Vercel site + Cloudflare Worker API, both free)
1. API: `npx wrangler login`, `npx wrangler deploy` (note the https://lofi-haven.<you>.workers.dev URL).
   Then `npx wrangler secret put JAAS_APP_ID` / `JAAS_KID` / `JAAS_PRIVATE_KEY` (one-line key with \n).
2. Site: push to GitHub, import the repo in Vercel (Vite is auto-detected), add env var
   `VITE_API_URL` = your Worker URL, deploy.
3. Lock the API to your site: set `ALLOWED_ORIGIN` in wrangler.toml to your Vercel URL, run `npx wrangler deploy` again.
