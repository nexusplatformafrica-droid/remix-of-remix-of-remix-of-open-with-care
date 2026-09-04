import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ROYAL } from "./royal-config";

/**
 * Opens a Royal Fortune player session on the remote game server and returns a
 * single-use launch URL. Signed server-to-server with the shared secret.
 */
export const createRoyalLaunch = createServerFn({ method: "POST" })
  .inputValidator((input: { playerId: string; currency?: string; mode?: "real" | "demo" }) => {
    if (!input?.playerId) throw new Error("playerId required");
    return {
      playerId: String(input.playerId).slice(0, 120),
      currency: (input.currency ?? ROYAL.currency).slice(0, 8),
      mode: input.mode === "demo" ? ("demo" as const) : ("real" as const),
    };
  })
  .handler(async ({ data }) => {
    const base = (process.env["ROYAL_BASE_URL"] ?? ROYAL.baseUrl).replace(/\/$/, "");
    const operatorId = process.env["ROYAL_OPERATOR_ID"] || ROYAL.operatorId;
    const secret = process.env["ROYAL_API_SECRET"] || ROYAL.secret;

    // The game server calls our wallet API server-to-server, so the origin we
    // hand it must be publicly reachable from the internet.
    //  * `id-preview--…` hosts redirect every request -> map to `project--…-dev`.
    //  * inside the sandbox the request can arrive as `localhost` / an internal
    //    host, which the game server can never call back — fall back to the
    //    project's stable public host in that case.
    const req = getRequest();
    const requestUrl = new URL(req.url);
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost || req.headers.get("host") || requestUrl.host;
    const proto = req.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
    const rawOrigin = `${proto}://${host}`;

    const mapped = rawOrigin.replace(
      /^https?:\/\/id-preview--([0-9a-f-]+)\.lovable\.app$/i,
      "https://project--$1-dev.lovable.app",
    );
    const reachable = /^https:\/\//i.test(mapped) && !/localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(:|$)/i.test(mapped);

    const origin = (process.env["ROYAL_WALLET_ORIGIN"] || (reachable ? mapped : ROYAL.walletOrigin))
      .replace(/\/$/, "");
    const walletUrl = `${origin}${ROYAL.walletPath}`;


    const body = JSON.stringify({
      operatorId,
      playerId: data.playerId,
      currency: data.currency,
      mode: data.mode,
      walletUrl,
      playerToken: data.playerId,
      returnUrl: `${origin}/slot`,
      locale: "en",
    });

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const signature =
      "sha256=" +
      [...new Uint8Array(sigBytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

    try {
      const res = await fetch(`${base}/api/public/rgs/session`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-rgs-operator": operatorId,
          "x-rgs-signature": signature,
        },
        body,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        let reason = "";
        try {
          reason = (JSON.parse(detail) as { error?: string }).error ?? "";
        } catch {
          reason = detail.slice(0, 120);
        }
        return {
          launchUrl: null as string | null,
          error: `Game server rejected the session (${res.status}${reason ? `: ${reason}` : ""}).`,
        };
      }
      const json = (await res.json()) as { launchUrl?: string };
      if (!json.launchUrl)
        return { launchUrl: null as string | null, error: "No launch URL returned." };
      return { launchUrl: json.launchUrl, error: null as string | null };
    } catch {
      return { launchUrl: null as string | null, error: "Could not reach the game server." };
    }
  });
