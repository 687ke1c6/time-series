import { getRouteApi, Link, useNavigate } from "@tanstack/solid-router";
import Gauge from "lucide-solid/icons/gauge";
import Plus from "lucide-solid/icons/plus";
import Settings from "lucide-solid/icons/settings";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  Show,
} from "solid-js";

import { kindLabel } from "@/api";
import { HomeLink } from "@/App";
import TimeSeriesChart, { type Point } from "@/components/TimeSeriesChart";
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { forecastToZero } from "@/lib/forecast";
import { cn } from "@/lib/utils";

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });
const rate = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 3 });
const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const kindRoute = getRouteApi("/kinds/$kindId");

/** One type's samples: a chart over time, with every sample listed below it. */
export default function KindPage() {
  const params = kindRoute.useParams();
  const search = kindRoute.useSearch();
  const navigate = useNavigate();

  const data = kindRoute.useLoaderData();
  const kindId = () => params().kindId;
  const kind = () => data().kind;
  const kinds = () => data().kinds;
  const samples = () => data().samples;

  const points = createMemo<Point[]>(() =>
    samples().map((s) => ({
      date: new Date(s.recorded_at),
      value: s.value,
    })),
  );
  const savedIndex = createMemo(
    () => samples().findIndex((s) => s.id === search().saved) ?? -1,
  );
  // Only types with the forecast setting get the switch; it starts off.
  const [showForecast, setShowForecast] = createSignal(false);
  createEffect(on(kindId, () => setShowForecast(false), { defer: true }));
  const forecast = createMemo(() =>
    kind().forecast && showForecast() ? forecastToZero(points()) : null,
  );
  const unit = () => (kind().unit ? ` ${kind().unit}` : "");

  return (
    <div class="space-y-6">
      <HomeLink />
      <header class="flex items-center gap-2">
        <h1 class="min-w-0 flex-1 truncate text-2xl font-bold sm:text-3xl">
          {kind().name}
          <Show when={kind().unit}>
            {(u) => (
              <span class="ml-2 text-base font-normal text-muted-foreground">
                ({u()})
              </span>
            )}
          </Show>
        </h1>
        {/* A native <select> stretched invisibly over the icon, so a tap
                    opens the OS picker while only the icon shows. */}
        <div
          title="Switch type"
          class={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "relative shrink-0 focus-within:ring-2 focus-within:ring-ring",
          )}
        >
          <Gauge class="size-5" aria-hidden="true" />
          <select
            aria-label="Switch type"
            class="absolute inset-0 cursor-pointer text-base opacity-0"
            value={kind().id}
            onChange={(e) => {
              const value = e.currentTarget.value;
              if (value === "new") {
                e.currentTarget.value = String(kind().id);
                void navigate({ to: "/kinds/new" });
              } else {
                void navigate({
                  to: "/kinds/$kindId",
                  params: { kindId: Number(value) },
                });
              }
            }}
          >
            <For each={kinds()}>
              {(k) => <option value={k.id}>{kindLabel(k)}</option>}
            </For>
            <option value="new">+ New type…</option>
          </select>
        </div>
        <Link
          to="/kinds/$kindId/settings"
          params={{ kindId: kind().id }}
          title="Type settings"
          aria-label="Type settings"
          class={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "shrink-0",
          )}
        >
          <Settings class="size-5" aria-hidden="true" />
        </Link>
      </header>

      <p aria-live="polite" class="text-sm text-muted-foreground">
        <Show when={savedIndex() >= 0 && samples()[savedIndex()]}>
          {(s) => (
            <>
              ✓ Saved {number.format(s().value)}
              {unit()} · {dateTime.format(new Date(s().recorded_at))}
            </>
          )}
        </Show>
      </p>

      <Show when={points().length > 0}>
        <section aria-label={`${kind().name} chart`} class="space-y-2">
          <Show when={kind().forecast}>
            <div class="flex items-center justify-end gap-2">
              <span
                id="forecast-switch-label"
                class="text-sm text-muted-foreground"
              >
                Forecast
              </span>
              <Switch
                checked={showForecast()}
                onChange={setShowForecast}
                aria-labelledby="forecast-switch-label"
              />
            </div>
          </Show>
          <TimeSeriesChart
            data={points()}
            unit={kind().unit}
            highlight={points()[savedIndex()] ?? null}
            forecast={forecast()}
            label={`${kind().name} over time, ${points().length} samples`}
          />
          <Show
            when={forecast()}
            fallback={
              <Show when={showForecast()}>
                <p class="text-sm text-muted-foreground">
                  No forecast: it needs at least two recent samples trending
                  down, with the latest still above zero.
                </p>
              </Show>
            }
          >
            {(f) => (
              <p class="text-sm text-muted-foreground">
                At {rate.format(f().perDay)}
                {unit()}/day (trend of the last {f().basedOn} samples), this
                reaches 0 around{" "}
                <span class="font-medium text-foreground">
                  {date.format(f().to.date)}
                </span>
                .
              </p>
            )}
          </Show>
        </section>
      </Show>

      <section aria-labelledby="samples-heading" class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <h2
            id="samples-heading"
            class="text-sm font-medium text-muted-foreground"
          >
            All samples ({points().length})
          </h2>
          <Link
            to="/kinds/$kindId/samples/new"
            params={{ kindId: kind().id }}
            title="Add sample"
            aria-label="Add sample"
            class={cn(buttonVariants({ size: "icon" }), "rounded-full")}
          >
            <Plus class="size-5" aria-hidden="true" />
          </Link>
        </div>
        <Show
          when={points().length > 0}
          fallback={
            <p class="text-sm text-muted-foreground">
              No samples of this type yet. Tap + to add one.
            </p>
          }
        >
          <table class="w-full text-sm">
            <thead class="sr-only">
              <tr>
                <th>When</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {/* Newest first; the chart reads left to right, the list top down. */}
              <For each={[...samples()].reverse()}>
                {(s) => (
                  <tr
                    class={cn(
                      "border-b border-border last:border-0",
                      s.id === search().saved && "bg-accent font-medium",
                    )}
                  >
                    <td class="py-2 pr-3 text-muted-foreground">
                      {dateTime.format(new Date(s.recorded_at))}
                    </td>
                    <td class="py-2 text-right tabular-nums">
                      {number.format(s.value)}
                      {unit()}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </section>
    </div>
  );
}
