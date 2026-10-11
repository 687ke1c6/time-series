import { For, type JSX } from "solid-js";

import { Skeleton } from "@/components/ui/skeleton";

/** Faint graph paper + chart-color wash behind the landing page. */
export function HomeBackdrop() {
  return (
    <div
      aria-hidden="true"
      class="home-backdrop pointer-events-none fixed inset-0 -z-10"
    />
  );
}

function Loading(props: { children: JSX.Element }) {
  return (
    <div role="status" aria-live="polite">
      <span class="sr-only">Loading…</span>
      {props.children}
    </div>
  );
}

/** Landing page: title, intro line and a grid of type tiles. */
export function HomeSkeleton() {
  return (
    <Loading>
      <HomeBackdrop />
      <div class="space-y-8">
        <div class="space-y-3 pt-4 sm:pt-8">
          <Skeleton class="h-9 w-40 sm:h-10" />
          <Skeleton class="h-5 w-64 max-w-full" />
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <For each={[0, 1, 2, 3]}>
            {() => <Skeleton class="h-28 rounded-xl" />}
          </For>
        </div>
      </div>
    </Loading>
  );
}

/** Chart page: back link, title + icon buttons, chart, sample rows. */
export function KindSkeleton() {
  return (
    <Loading>
      <div class="space-y-6">
        <Skeleton class="h-5 w-24" />
        <div class="flex items-center gap-2">
          <Skeleton class="h-8 flex-1 sm:h-9" />
          <Skeleton class="size-10" />
          <Skeleton class="size-10" />
        </div>
        <Skeleton class="h-[220px] w-full sm:h-[300px]" />
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <Skeleton class="h-5 w-32" />
            <Skeleton class="size-10 rounded-full" />
          </div>
          <For each={[0, 1, 2, 3, 4]}>
            {() => <Skeleton class="h-6 w-full" />}
          </For>
        </div>
      </div>
    </Loading>
  );
}

/** Form pages: back link, title and a few labelled fields. */
export function FormSkeleton() {
  return (
    <Loading>
      <div class="space-y-6">
        <Skeleton class="h-5 w-24" />
        <div class="space-y-2">
          <Skeleton class="h-4 w-24" />
          <Skeleton class="h-8 w-56 max-w-full sm:h-9" />
        </div>
        <For each={[0, 1, 2]}>
          {() => (
            <div class="space-y-2">
              <Skeleton class="h-4 w-16" />
              <Skeleton class="h-11 w-full" />
            </div>
          )}
        </For>
        <Skeleton class="h-12 w-full" />
      </div>
    </Loading>
  );
}
