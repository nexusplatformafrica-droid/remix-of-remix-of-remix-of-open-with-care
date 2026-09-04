import { createServerFn } from "@tanstack/react-start";

export const getVirtualOffer = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchVirtualOffer } = await import("./virtual.server");
  return fetchVirtualOffer();
});

export const getVirtualResults = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchVirtualResults } = await import("./virtual.server");
  return fetchVirtualResults();
});
