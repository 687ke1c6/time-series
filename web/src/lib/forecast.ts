import type { Point } from "@/components/TimeSeriesChart";

const DAY_MS = 86_400_000;

export type Forecast = {
  /** The last real sample; the forecast line starts here. */
  from: Point;
  /** Where the trend reaches zero. */
  to: Point;
  /** Change per day (always negative). */
  perDay: number;
  /** How many recent samples the trend is based on. */
  basedOn: number;
};

/** How the recent samples are weighted when fitting the trend. */
export type Average = "sma" | "ema";

export type ForecastOptions = {
  /** How many recent samples the trend is fitted to. */
  window: number;
  /** "sma" weighs them equally; "ema" weighs recent ones more. */
  average: Average;
};

export const WINDOWS = [3, 5, 10, 20] as const;
export const DEFAULT_OPTIONS: ForecastOptions = { window: 3, average: "sma" };

const storageKey = (kindId: number) => `forecast-options:${kindId}`;

/** The options last chosen for this kind, or the defaults. */
export function loadForecastOptions(kindId: number): ForecastOptions {
  try {
    const raw = localStorage.getItem(storageKey(kindId));
    const saved = raw ? (JSON.parse(raw) as Partial<ForecastOptions>) : {};
    return {
      window: WINDOWS.includes(saved.window as (typeof WINDOWS)[number])
        ? saved.window!
        : DEFAULT_OPTIONS.window,
      average:
        saved.average === "sma" || saved.average === "ema"
          ? saved.average
          : DEFAULT_OPTIONS.average,
    };
  } catch {
    // Storage blocked or unparseable: fall back rather than break the chart.
    return DEFAULT_OPTIONS;
  }
}

export function saveForecastOptions(kindId: number, options: ForecastOptions) {
  try {
    localStorage.setItem(storageKey(kindId), JSON.stringify(options));
  } catch {
    // Storage blocked: the choice just won't persist.
  }
}

/**
 * Projects the recent trend down to zero. The slope is a weighted least-squares
 * fit through the last `window` samples (so one odd reading doesn't dominate),
 * drawn from the latest sample. With "ema", each step back in time weighs
 * (1 - α) as much, α = 2 / (window + 1). Returns null unless the trend is
 * downward and the latest value is still above zero.
 */
export function forecastToZero(
  points: Point[],
  { window, average }: ForecastOptions = DEFAULT_OPTIONS,
): Forecast | null {
  const recent = points.slice(-window);
  if (recent.length < 2) return null;

  const xs = recent.map((p) => p.date.getTime());
  const ys = recent.map((p) => p.value);
  const alpha = 2 / (window + 1);
  const ws = recent.map((_, i) =>
    average === "ema" ? (1 - alpha) ** (recent.length - 1 - i) : 1,
  );
  const sumW = ws.reduce((a, b) => a + b);
  const meanX = xs.reduce((a, x, i) => a + ws[i] * x, 0) / sumW;
  const meanY = ys.reduce((a, y, i) => a + ws[i] * y, 0) / sumW;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += ws[i] * (xs[i] - meanX) * (ys[i] - meanY);
    den += ws[i] * (xs[i] - meanX) ** 2;
  }
  // All samples at the same moment: there's no time trend to project.
  if (den === 0) return null;

  const slopePerMs = num / den;
  const from = recent[recent.length - 1];
  if (slopePerMs >= 0 || from.value <= 0) return null;

  const zeroAt = new Date(from.date.getTime() + from.value / -slopePerMs);
  return {
    from,
    to: { date: zeroAt, value: 0 },
    perDay: slopePerMs * DAY_MS,
    basedOn: recent.length,
  };
}
