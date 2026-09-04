/**
 * Bundles worker/src/worker.ts into the single pasteable file
 * worker/cloudflare-worker.js (no imports, no config, no build step needed
 * on Cloudflare's side).
 *
 *     bun run build:worker
 */
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";

const OUT = new URL("./cloudflare-worker.js", import.meta.url);

const banner = `/**
 * BET PLUS+ — settlement worker for Cloudflare Workers.
 *
 * GENERATED FILE — edit worker/src/worker.ts and run: bun run build:worker
 *
 * ZERO CONFIGURATION. Paste this whole file into the Cloudflare Worker editor
 * and click Deploy. No secrets, no environment variables, no service account,
 * no bindings, no expiry, no payment.
 *
 * HOW TO DEPLOY (2 minutes)
 *  1. Cloudflare dashboard -> Compute (Workers) -> Create -> Hello World.
 *  2. Delete everything in the editor, paste this file, click Deploy.
 *  3. Worker -> Settings -> Triggers -> Cron Triggers -> Add:  * * * * *
 *  4. Open the worker URL for a status page, or add /run to force a pass.
 *
 * It grades every market the website offers using the exact same engine the
 * site runs (src/lib/market-grading.ts), and talks to the database over the
 * public REST API with the public web key — no admin service account.
 */
`;

await build({
  entryPoints: [new URL("./src/worker.ts", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "neutral",
  outfile: OUT.pathname,
  banner: { js: banner },
  legalComments: "none",
});

const text = await readFile(OUT, "utf8");
await writeFile(OUT, text);
console.log(`built worker/cloudflare-worker.js (${text.length} bytes)`);
