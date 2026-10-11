import * as Plot from "@observablehq/plot";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";

import type { Forecast } from "@/lib/forecast";

export type Point = { date: Date; value: number };

const SERIES = "var(--chart-1)";
const SURFACE = "var(--background)";
// Past this many points, per-point dots become noise; the line carries the shape.
const MAX_DOTS = 60;

const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 2,
});
const full = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });
const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * Line chart of one series over time, sized to its container. Hovering shows
 * a crosshair and a tooltip for the nearest sample; `highlight` rings one point.
 * A dashed rule marks today, and `forecast` draws a dashed projection to zero.
 */
export default function TimeSeriesChart(props: {
  data: Point[];
  unit?: string | null;
  highlight?: Point | null;
  forecast?: Forecast | null;
  label?: string;
}) {
  let container!: HTMLDivElement;
  const [width, setWidth] = createSignal(0);

  onMount(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(container);
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    const w = width();
    if (!w) return;
    const data = props.data;
    const unit = props.unit ? ` ${props.unit}` : "";
    const xy = { x: "date", y: "value" } as const;
    const today = new Date();
    const forecast = props.forecast;

    const chart = Plot.plot({
      width: w,
      height: w < 480 ? 220 : 300,
      marginLeft: 44,
      // A string, because Plot's style typing doesn't allow custom properties.
      style: `font-size: 12px; background: transparent; --plot-background: ${SURFACE};`,
      x: { type: "time", label: null, ticks: w < 480 ? 4 : 8 },
      y: {
        label: props.unit ?? null,
        grid: true,
        nice: true,
        tickFormat: (d) => compact.format(d),
      },
      marks: [
        Plot.ruleX([today], {
          stroke: "currentColor",
          strokeOpacity: 0.6,
          strokeDasharray: "2,3",
        }),
        Plot.text([today], {
          x: (d: Date) => d,
          text: () => "Today",
          frameAnchor: "top",
          textAnchor: "end",
          dx: -4,
          dy: 4,
          fill: "currentColor",
        }),
        forecast
          ? [
              Plot.lineY([forecast.from, forecast.to], {
                ...xy,
                stroke: SERIES,
                strokeWidth: 2,
                strokeDasharray: "6,4",
                strokeOpacity: 0.7,
              }),
              Plot.dot([forecast.to], {
                ...xy,
                r: 4,
                fill: SURFACE,
                stroke: SERIES,
                strokeWidth: 2,
              }),
              Plot.text([forecast.to], {
                ...xy,
                text: (d: Point) => `0 · ${date.format(d.date)}`,
                textAnchor: "end",
                dy: -12,
                fill: "currentColor",
              }),
            ]
          : null,
        Plot.lineY(data, { ...xy, stroke: SERIES, strokeWidth: 2 }),
        data.length <= MAX_DOTS
          ? Plot.dot(data, {
              ...xy,
              r: 4,
              fill: SERIES,
              stroke: SURFACE,
              strokeWidth: 2,
            })
          : null,
        props.highlight
          ? Plot.dot([props.highlight], {
              ...xy,
              r: 7,
              fill: SURFACE,
              stroke: SERIES,
              strokeWidth: 3,
            })
          : null,
        Plot.ruleX(
          data,
          Plot.pointerX({
            x: "date",
            stroke: "currentColor",
            strokeOpacity: 0.3,
          }),
        ),
        Plot.dot(
          data,
          Plot.pointerX({
            ...xy,
            r: 5,
            fill: SERIES,
            stroke: SURFACE,
            strokeWidth: 2,
          }),
        ),
        Plot.tip(
          data,
          Plot.pointerX({
            ...xy,
            title: (d: Point) =>
              `${full.format(d.value)}${unit}\n${dateTime.format(d.date)}`,
          }),
        ),
      ],
    });
    chart.setAttribute("role", "img");
    if (props.label) chart.setAttribute("aria-label", props.label);
    container.replaceChildren(chart);
    onCleanup(() => chart.remove());
  });

  return <div ref={container} class="w-full text-muted-foreground" />;
}
