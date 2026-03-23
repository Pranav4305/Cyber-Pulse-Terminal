# Cyber Pulse Terminal

A zero-cost cybersecurity news web app with a terminal-inspired UI.

## What this includes

- Cyber-themed responsive frontend (HTML, CSS, JS)
- Serverless API endpoint at `/api/news` via Cloudflare Pages Functions
- Multi-source RSS aggregation
- Sorted latest headlines + lightweight caching

## Free deployment (Cloudflare Pages)

1. Create a GitHub repo and push this project.
2. Open Cloudflare Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git.
3. Select your repo.
4. Build settings:
   - Framework preset: `None`
   - Build command: (leave empty)
   - Build output directory: `/`
5. Deploy.

Cloudflare will host your app on a free `*.pages.dev` URL.

## Local development (optional)

If you want local preview with functions:

1. Install Node.js LTS.
2. Install Wrangler globally:
   - `npm install -g wrangler`
3. Run:
   - `wrangler pages dev .`
4. Open the local URL shown in terminal.

## Sources configured

- KrebsOnSecurity
- BleepingComputer
- Schneier on Security
- The Hacker News

If one source is down, the app still works with available feeds.