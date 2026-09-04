# Always-on settlement worker

`settlement-worker.mjs` is a single, dependency-free Node file. It settles every
player's tickets around the clock — the player does not need the site open,
does not need to be logged in, and does not need to be online. When they come
back, their wallet is already credited and the ticket already reads won / lost /
void.

## Deploy to Railway (2 minutes)

1. New Project → **Deploy from repo** (or "Empty service" → paste the file).
2. Make sure the file is at the project root and the start command is:
   ```
   node settlement-worker.mjs
   ```
3. Add these variables. The easiest way is to paste the **entire service account JSON** into one variable:

   | Variable | Value |
   | --- | --- |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | full JSON from Firebase service account key file |
   | `ALLSPORTS_API_KEY` | optional, defaults to the site key |
   | `POLL_MS` | optional, defaults to `2000` |
   | `PORT` | do not set manually; Railway provides it automatically |

   Or, if you prefer, split the JSON into three separate variables:

   | Variable | Value |
   | --- | --- |
   | `FIREBASE_PROJECT_ID` | `betplus-africa` |
   | `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-…@betplus-africa.iam.gserviceaccount.com` |
   | `FIREBASE_PRIVATE_KEY` | the `private_key` value, `\n` escapes are fine |
   | `ALLSPORTS_API_KEY` | optional, defaults to the site key |
   | `POLL_MS` | optional, defaults to `2000` |

   Get the JSON from Firebase console → Project settings → Service accounts → Generate new private key.

4. Open the Railway public URL. It should return JSON containing
   `"ok": true`. The same health response is available at `/health`.

The worker must listen on Railway's `PORT`, even though settlement itself does
not need a website. This file includes that health endpoint so Railway will not
show **Application failed to respond** while the settlement loop runs.

The same file runs unchanged on Render, Fly.io, a VPS, or `node settlement-worker.mjs`
on your own machine.

## Vercel

The website itself stays fully serverless — nothing else is required for Vercel.
The worker is separate on purpose: Vercel's free plan cannot run a process that
polls every 2 seconds.

## Settlement rules (identical in the site and the worker)

- Every leg is graded continuously: **won**, **lost**, **void** or still pending.
- Any lost leg marks the whole ticket **lost immediately**, but the remaining
  legs keep updating so the player sees exactly how many they won and lost.
- All legs won → ticket **won**, wallet credited once (guarded by a `paid` flag
  so the site and the worker can never double-pay).
- Postponed / cancelled / abandoned fixture → that leg is **void** and its odds
  are reset to `1.00`; if every leg is void the stake is refunded.
- Market timing is respected: full-time markets settle at FT, half-time markets
  at HT, `Over X` wins the moment the line is beaten, `Under X` loses at that
  same moment, BTTS settles as soon as both teams have scored, correct score
  loses as soon as it becomes impossible, handicaps and draw-no-bet push to void
  on an exact tie.
