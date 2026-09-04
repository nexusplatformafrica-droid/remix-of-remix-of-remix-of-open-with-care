import { createFileRoute } from "@tanstack/react-router";

/** Authoritative clock so the UI never trusts a wrong device time. */
export const Route = createFileRoute("/api/public/time")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ now: Date.now(), tz: "Africa/Kampala" }), {
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        }),
    },
  },
});
