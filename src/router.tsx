import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageLoading } from "./components/xbet/PageLoading";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // Show the skeleton the instant a nav item is tapped.
    defaultPendingMs: 0,
    defaultPendingMinMs: 300,
    defaultPendingComponent: PageLoading,
  });

  return router;
};

