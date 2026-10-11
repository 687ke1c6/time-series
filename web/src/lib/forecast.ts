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

/**
 * Projects the recent trend down to zero. The slope is a least-squares fit
 * through the last `window` samples (so one odd reading doesn't dominate),
 * drawn from the latest sample. Returns null unless the trend is downward
 * and the latest value is still above zero.
 */
export function forecastToZero(points: Point[], window = 3): Forecast | null {
  const recent = points.slice(-window);
  if (recent.length < 2) return null;

  const xs = recent.map((p) => p.date.getTime());
  const ys = recent.map((p) => p.value);
  const meanX = xs.reduce((a, b) => a + b) / xs.length;
  const meanY = ys.reduce((a, b) => a + b) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
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
