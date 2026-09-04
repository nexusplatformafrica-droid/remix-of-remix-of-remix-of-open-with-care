# Always-on settlement worker

`cloudflare-worker.js` settles every player's tickets around the clock. The
player does not need the site open, does not need to be logged in, and does not
need to be online. When they come back, their wallet is already credited and the
ticket already reads won / lost / void.

## Deploy on Cloudflare (2 minutes, nothing to configure)

1. Cloudflare dashboard → **Compute (Workers)** → **Create** → *Start from Hello World*.
2. Delete everything in the editor, paste the whole of `cloudflare-worker.js`, click **Deploy**.
3. Open the worker → **Settings → Triggers → Cron Triggers → Add**:

   ```
   * * * * *
   ```

   That is "every minute", and it is included on Cloudflare's free plan.
4. Open the worker URL — you should see a JSON status page. Add `/run` to the
   URL to force one settlement pass immediately and see exactly what it settled.

There are **no secrets, no environment variables, no service account, no
bindings and no paid add-ons**. Everything the worker needs is already inside
the file. It never expires and there is nothing to renew.

## Why the old worker stopped settling

The previous version polled the database every 2 seconds — roughly 43,000
queries a day. That exhausts the free daily read allowance within minutes, after
which the database rejects everything and nothing settles. It also required a
Firebase **admin service account** private key.

This version:

- runs once a minute (~1,440 passes a day) instead of 43,200,
- reads only tickets that are still open, capped at 120 per pass,
- checks at most 60 fixtures per pass, 6 at a time,
- uses the **public** Firebase REST API with the same public web key the website
  itself already ships — so there is no private key to leak, rotate or configure.

Those limits keep it permanently and comfortably inside the free tier.

## Safety

- Every ticket update carries an `updateTime` precondition, so if the website
  settled a ticket a moment earlier the worker's write is refused. The site and
  the worker can never double-pay.
- A `paid` flag is written alongside the payout as a second guard.

## `settlement-worker.mjs` (legacy)

The old Node version is kept for reference only. It needs a Firebase admin
service account and a host that can run a permanent process (Railway, Render,
Fly, a VPS). Prefer the Cloudflare file above.

## Settlement rules (identical in the site and the worker)

- Every leg is graded continuously: **won**, **lost**, **void** or still pending.
- Any lost leg marks the whole ticket **lost immediately**, but the remaining
  legs keep updating so the player sees exactly how many they won and lost.
- All legs won → ticket **won**, wallet credited once.
- Postponed / cancelled / abandoned fixture → that leg is **void** and its odds
  are reset to `1.00`; if every leg is void the stake is refunded.
- Market timing is respected: full-time markets settle at FT, half-time markets
  at HT, `Over X` wins the moment the line is beaten, `Under X` loses at that
  same moment, BTTS settles as soon as both teams have scored, correct score
  loses as soon as it becomes impossible, handicaps and draw-no-bet push to void
  on an exact tie.
