// Typed helpers for the axum API. Errors carry the server's `{"error": "..."}` message.

export type Unit = { symbol: string; label: string };
export type UnitGroup = { group: string; units: Unit[] };
/** The editable settings of a kind. */
export type KindSettings = {
  name: string;
  unit: string | null;
  /** Offer a forecast-to-zero on the chart. */
  forecast: boolean;
};
export type Kind = { id: number } & KindSettings;
export type Sample = {
  id: number;
  kind_id: number;
  value: number;
  recorded_at: string;
};

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(
      "Can't reach the server. Check your connection and try again.",
    );
  }
  const body = await res.json().catch(() => null);
  if (!res.ok)
    throw new ApiError(body?.error ?? `Request failed (HTTP ${res.status})`);
  return body as T;
}

function postJson<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
}

export const fetchUnits = () => request<UnitGroup[]>("/api/units");

export const fetchKinds = () => request<Kind[]>("/api/kinds");

export const createKind = (settings: KindSettings) =>
  postJson<Kind>("/api/kinds", settings);

/** Omit `recorded_at` to let the server stamp the current time. */
export const createSample = (sample: {
  kind_id: number;
  value: number;
  recorded_at?: string;
}) => postJson<Sample>("/api/samples", sample);

/** All samples of one kind, oldest first. */
export const fetchSamples = (kindId: number) =>
  request<Sample[]>(`/api/samples?kind_id=${kindId}`);

/** Replaces a kind's settings. */
export const updateKind = (id: number, settings: KindSettings) =>
  request<Kind>(`/api/kinds/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(settings),
  });

/** "Water meter (m³)", or just the name when there's no unit. */
export function kindLabel(kind: Kind) {
  return kind.unit ? `${kind.name} (${kind.unit})` : kind.name;
}
