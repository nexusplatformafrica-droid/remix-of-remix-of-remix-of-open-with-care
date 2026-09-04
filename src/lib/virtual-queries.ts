import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getVirtualOffer, getVirtualResults } from "./virtual.functions";

/** The offer rolls over every ~5 minutes; poll fast so odds never go stale. */
export const virtualOfferQuery = () =>
  queryOptions({
    queryKey: ["virtual", "offer"],
    queryFn: () => getVirtualOffer(),
    staleTime: 2_000,
    refetchInterval: 3_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

/** Results drive settlement, so they refresh every second, silently. */
export const virtualResultsQuery = () =>
  queryOptions({
    queryKey: ["virtual", "results"],
    queryFn: () => getVirtualResults(),
    staleTime: 0,
    refetchInterval: 1_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
