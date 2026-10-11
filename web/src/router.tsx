import {
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
} from "@tanstack/solid-router";

import { fetchKinds, fetchSamples, fetchUnits } from "@/api";
import App, { ErrorPage, KindNotFound, NotFound } from "@/App";
import {
  FormSkeleton,
  HomeSkeleton,
  KindSkeleton,
} from "@/components/Skeletons";
import HomePage from "@/pages/HomePage";
import KindPage from "@/pages/KindPage";
import KindSettingsPage from "@/pages/KindSettingsPage";
import NewKindPage from "@/pages/NewKindPage";
import NewSamplePage from "@/pages/NewSamplePage";

// Data loads in route loaders, not in components. Loaders start as soon as a
// navigation (or a hover/touch preload) begins, and the route's
// pendingComponent skeleton shows while they're slow.

/** The kind with `kindId` plus the full list (for the type switcher). */
async function loadKind(kindId: number) {
  const kinds = await fetchKinds();
  const kind = kinds.find((k) => k.id === kindId);
  if (!kind) throw notFound();
  return { kind, kinds };
}

const rootRoute = createRootRoute({
  component: App,
  notFoundComponent: NotFound,
});

/** Landing page: a tile per type. */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: async () => ({ kinds: await fetchKinds() }),
  pendingComponent: HomeSkeleton,
  component: HomePage,
});

/** `$kindId` as a number. Non-numeric ids don't match and fall through to NotFound. */
const kindIdParams = {
  parse: ({ kindId }: { kindId: string }) => {
    const id = Number(kindId);
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new Error(`invalid kind id: ${kindId}`);
    return { kindId: id };
  },
  stringify: ({ kindId }: { kindId: number }) => ({ kindId: String(kindId) }),
};

const newKindRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kinds/new",
  loader: async () => ({ units: await fetchUnits() }),
  pendingComponent: FormSkeleton,
  component: NewKindPage,
});

/** One type's chart and samples. */
const kindRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kinds/$kindId",
  params: kindIdParams,
  // `saved` is the id of a sample just saved from the form, to confirm and highlight it.
  validateSearch: (search: Record<string, unknown>): { saved?: number } => {
    const saved = Number(search.saved);
    return Number.isSafeInteger(saved) && saved > 0 ? { saved } : {};
  },
  loader: async ({ params }) => {
    const [kind, samples] = await Promise.all([
      loadKind(params.kindId),
      fetchSamples(params.kindId),
    ]);
    return { ...kind, samples };
  },
  pendingComponent: KindSkeleton,
  notFoundComponent: KindNotFound,
  component: KindPage,
});

const kindSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kinds/$kindId/settings",
  params: kindIdParams,
  loader: async ({ params }) => {
    const [{ kind }, units] = await Promise.all([
      loadKind(params.kindId),
      fetchUnits(),
    ]);
    return { kind, units };
  },
  pendingComponent: FormSkeleton,
  notFoundComponent: KindNotFound,
  component: KindSettingsPage,
});

/** The add-sample form for one type. */
const newSampleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kinds/$kindId/samples/new",
  params: kindIdParams,
  loader: ({ params }) => loadKind(params.kindId),
  pendingComponent: FormSkeleton,
  notFoundComponent: KindNotFound,
  component: NewSamplePage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    newKindRoute,
    kindRoute,
    kindSettingsRoute,
    newSampleRoute,
  ]),
  defaultPreload: "intent",
  // Fast loads swap pages without a flash; slower ones show the skeleton
  // after 150ms and keep it at least 300ms so it doesn't flicker.
  defaultPendingMs: 150,
  defaultPendingMinMs: 300,
  defaultErrorComponent: ErrorPage,
});

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}
