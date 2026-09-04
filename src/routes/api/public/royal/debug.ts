import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";

/** Temporary diagnostic: reports the origin the game server would be given. */
export const Route = createFileRoute("/api/public/royal/debug")({
  server: {
    handlers: {
      GET: async () => {
        const req = getRequest();
        return new Response(
          JSON.stringify({
            url: req.url,
            host: req.headers.get("host"),
            forwardedHost: req.headers.get("x-forwarded-host"),
            proto: req.headers.get("x-forwarded-proto"),
            origin: req.headers.get("origin"),
            referer: req.headers.get("referer"),
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
