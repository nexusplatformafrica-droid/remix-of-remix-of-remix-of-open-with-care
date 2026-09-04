# Roadmap

- [x] Open the uploaded BET PLUS+ project and get it running
- [x] Replace the dead AllSportsAPI key with the new working key
- [x] Rewrite the settlement worker as a zero-config Cloudflare Worker
  - no Firebase admin service account
  - no secrets/env vars to configure in Cloudflare
  - cron-driven (every minute) instead of a 2-second poll, so the free
    Firebase daily quota is never exhausted again
  - manual `/run` endpoint + `/` health page
- [ ] User deploys it on Cloudflare and sends back the worker URL

## Done
- Shared grading engine (src/lib/market-grading.ts) now used by the site and the worker; all markets incl. BTTS labels ("Both Teams To Score - Yes"), handicaps, HT/FT, combos.
- worker/cloudflare-worker.js is generated from worker/src/worker.ts via `bun run build:worker`.
- Admin → Cleanup page deletes worker-saved polling data (never ticket status).
- wrangler.jsonc added for deploying the website to Cloudflare.
