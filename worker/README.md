# Always-on settlement worker

`cloudflare-worker.js` settles every player's tickets around the clock. The
player does not need the site open, does not need to be logged in and does not
need to be online. When they come back, their wallet is already credited and the
ticket already reads won / lost / void.

> Paste **`worker/cloudflare-worker.js`** into Cloudflare — not this README.
> This file is documentation, pasting it gives `Invalid or unexpected token`.

## Deploy on Cloudflare (2 minutes, nothing to configure)

1. Cloudflare dashboard → **Compute (Workers)** → **Create** → _Hello World_.
2. Delete everything in the editor, paste all of `worker/cloudflare-worker.js`, **Deploy**.
3. Worker → **Settings → Triggers → Cron Triggers → Add**: `* * * * *` (every minute, free plan).
4. Open the worker URL for a JSON status page; add `/run` to force one pass now.

No secrets, no environment variables, no service account, no bindings, no paid
add-ons, no expiry.

## Editing the worker

`cloudflare-worker.js` is **generated**. Edit the source and rebuild:

```
worker/src/worker.ts        # worker logic (fetching, database writes, cron)
src/lib/market-grading.ts   # market grading engine — shared with the website
src/lib/settle-core.ts      # ticket-level settlement — shared with the website
bun run build:worker        # -> worker/cloudflare-worker.js
```

Because the worker bundles the website's own engine, a leg can never grade
differently in the two places.

## Markets covered

1X2 (FT / HT / 2H), double chance, draw no bet, both teams to score (including
`Both Teams To Score - Yes`, `GG`/`NG` and first-half variants), over/under for
match and team totals with whole-line pushes, multigoals ranges, exact goals,
odd/even, correct score (with early impossible-loss), any other result, HT/FT,
Asian/European/quarter handicaps, clean sheet, win to nil, team to score, both
halves, either half, highest scoring half, winning margin, and `&`/`+`/`and`
combinations of any of the above. Postponed, cancelled, abandoned, suspended or
awarded fixtures void the leg and reset its odds to 1.00.

## Free-tier safety

- Runs once a minute (~1,440 passes/day), not every 2 seconds (~43,200).
- Reads only open tickets, capped at 200 per pass; at most 90 fixture lookups.
- Uses the **public** REST API with the public web key — no private key.
- Every write carries an `updateTime` precondition and a `paid` flag, so the
  site and the worker can never double-pay a ticket.

## Housekeeping

Admin → **Cleanup** deletes the polling data the worker saved (cached score
lines on finished legs, and the worker's payout log rows). It never changes a
ticket's status, legs, odds, stake, payout or any balance.

## Deploying the website to Cloudflare

`wrangler.jsonc` in the project root is ready:

```
bun run build
bunx wrangler deploy
```

Static assets ship from `.output/public` and SSR runs from
`.output/server/index.mjs`. To deploy from the dashboard instead, connect the
repository in **Workers & Pages**, build command `bun run build`, and Cloudflare
picks up `wrangler.jsonc` automatically.

## `settlement-worker.mjs` (legacy)

The old Node version is kept for reference only. It needs a Firebase admin
service account and a host that can run a permanent process, and it will throw
`Disallowed operation called within global scope` if pasted into Cloudflare.
