import { getRouteApi, Link } from "@tanstack/solid-router";
import ChartSpline from "lucide-solid/icons/chart-spline";
import Plus from "lucide-solid/icons/plus";
import { For, Show } from "solid-js";

import { HomeBackdrop } from "@/components/Skeletons";

const route = getRouteApi("/");

const tile =
  "flex h-full min-h-28 flex-col justify-between gap-3 rounded-xl border p-4 shadow-xs transition-[color,box-shadow,border-color] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Landing page: one tile per type, each leading to its add-sample form. */
export default function HomePage() {
  const data = route.useLoaderData();
  const kinds = () => data().kinds;

  return (
    <>
      <HomeBackdrop />

      <div class="space-y-8">
        <header class="pt-4 sm:pt-8">
          <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
            time-series
          </h1>
          <p class="mt-2 text-muted-foreground">
            <Show
              when={kinds().length === 0}
              fallback="Pick what you're measuring to add a sample."
            >
              Start by adding a type: the thing you're measuring, like a water
              meter or body weight.
            </Show>
          </p>
        </header>

        <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <For each={kinds()}>
            {(kind) => (
              <li>
                <Link
                  to="/kinds/$kindId/samples/new"
                  params={{ kindId: kind.id }}
                  aria-label={`Add a ${kind.name} sample`}
                  class={`${tile} border-border bg-background/80 backdrop-blur-sm hover:border-chart-1/60 hover:shadow-sm`}
                >
                  <ChartSpline class="size-5 text-chart-1" aria-hidden="true" />
                  <span>
                    <span class="line-clamp-2 font-semibold leading-snug">
                      {kind.name}
                    </span>
                    <span class="text-sm text-muted-foreground">
                      {kind.unit ?? "No unit"}
                    </span>
                  </span>
                </Link>
              </li>
            )}
          </For>
          <li>
            <Link
              to="/kinds/new"
              class={`${tile} border-dashed border-input bg-background/50 text-muted-foreground backdrop-blur-sm hover:border-ring hover:text-foreground`}
            >
              <Plus class="size-5" aria-hidden="true" />
              <span class="font-medium">
                {kinds().length === 0 ? "Add your first type" : "New type"}
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
