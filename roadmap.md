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
