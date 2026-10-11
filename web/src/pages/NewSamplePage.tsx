import { getRouteApi } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { HomeLink } from "@/App";
import SampleForm from "@/components/SampleForm";

const route = getRouteApi("/kinds/$kindId/samples/new");

/** Add a sample to the type in the URL. */
export default function NewSamplePage() {
  const data = route.useLoaderData();
  const kind = () => data().kind;

  return (
    <div class="space-y-6">
      <HomeLink />
      <header>
        <p class="text-sm text-muted-foreground">Add a sample</p>
        <h1 class="truncate text-2xl font-bold sm:text-3xl">
          {kind().name}
          <Show when={kind().unit}>
            {(unit) => (
              <span class="ml-2 text-base font-normal text-muted-foreground">
                ({unit()})
              </span>
            )}
          </Show>
        </h1>
      </header>
      <SampleForm kind={kind()} />
    </div>
  );
}
