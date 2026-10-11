# Plan: Sample entry form + storage

Status: **Approved, in progress.** Steps 1–4 done; step 5 awaiting manual browser check. Builds on [SCAFFOLD_PLAN.md](SCAFFOLD_PLAN.md).

## 1. Goal

A mobile-first form for recording a **sample**: a number, the **type** of thing being measured (e.g. "Water meter reading", "Energy consumption", "Body weight"), and when it was taken. Samples are stored in SQLite. Later, the chart will show **one type at a time** over time, with all of that type's samples listed below it.

Scope of this plan: the form, managing types, and storage. Charting and the sample list come later.

## 2. Data model

Two tables. Types are user-managed, so they get their own table, and samples reference them by id. That way a type can be renamed later without touching its samples.

**`kinds`** (the "type"; `type` is a reserved word in Rust, so it is called `kind` in code and in the DB, and "Type" in the UI)

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | |
| `name` | TEXT NOT NULL UNIQUE COLLATE NOCASE | trimmed, 1–100 chars; "body weight" and "Body Weight" count as the same type |
| `unit` | TEXT NULL | a symbol from the fixed unit list (§3a), e.g. `m³`, `kWh`, `kg`; NULL = no unit (plain number) |
| `forecast` | BOOLEAN NOT NULL DEFAULT FALSE | offer a forecast-to-zero switch on the chart (migration `0002_kind_forecast.sql`) |
| `created_at` | TEXT NOT NULL | UTC, RFC 3339 |

**`samples`**

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | |
| `kind_id` | INTEGER NOT NULL REFERENCES kinds(id) | foreign key (sqlx enables SQLite FK enforcement by default) |
| `value` | REAL NOT NULL | any finite number: decimals and negatives allowed; NaN/Infinity rejected |
| `recorded_at` | TEXT NOT NULL | UTC, RFC 3339, **minute resolution** (seconds truncated to `:00`); sorts correctly as text |
| `created_at` | TEXT NOT NULL | UTC, when the row was inserted (useful for auditing back-dated samples) |

Index on `samples(kind_id, recorded_at)`, because the chart query is "one type over a time range".

Per-type value rules (min/max etc.) are deferred. A `kinds` row is the natural place for them later.

## 3. Database

**SQLite via `sqlx` 0.9.0** (`sqlite`, `runtime-tokio`, `migrate` features), with **`chrono` 0.4.45** (`serde` feature) for timestamps.

- File: env var `DATABASE_URL`, default `sqlite://data/time-series.db?mode=rwc` (created if missing). Add `data/` to `.gitignore`.
- Migrations: `migrations/0001_init.sql`, run at startup with `sqlx::migrate!()`.
- Queries use the runtime `sqlx::query_as` API, not the compile-time `query!` macros, so builds don't need a live `DATABASE_URL` or `cargo sqlx prepare`.
- No seed data: the app starts with zero types, and the user creates the first one from the form.

## 3a. Units

A fixed list defined once in Rust (`src/units.rs`) and served to the UI, so the server validates against the same list the picker shows. Each unit has a symbol (what we store and show) and a label (what the picker shows), grouped by category:

| Group | Units (symbol — label) |
|---|---|
| Volume | `L` litre, `mL` millilitre, `m³` cubic metre, `gal` US gallon, `ft³` cubic foot |
| Energy | `kWh` kilowatt-hour, `Wh` watt-hour, `MJ` megajoule, `kcal` kilocalorie |
| Power | `W` watt, `kW` kilowatt |
| Mass | `kg` kilogram, `g` gram, `lb` pound, `oz` ounce, `st` stone |
| Length / distance | `mm` millimetre, `cm` centimetre, `m` metre, `km` kilometre, `in` inch, `ft` foot, `mi` mile |
| Temperature | `°C` Celsius, `°F` Fahrenheit |
| Pressure | `mbar` millibar, `kPa` kilopascal, `psi` psi, `mmHg` mmHg |
| Time | `s` seconds, `min` minutes, `h` hours |
| Speed | `km/h`, `mph`, `m/s` |
| Health | `bpm` beats/min, `mmol/L`, `mg/dL`, `%` percent |
| Money | `€` euro, `$` dollar, `£` pound sterling |
| Count | `count`, `steps` |
| Other | `units` units (generic catch-all) |

The unit is optional. The picker's first option is "No unit". Adding to the list later is a code change only (no migration). Free-text custom units are deferred.

## 4. API

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/units` | none | `[{group, units: [{symbol, label}]}]` |
| `GET` | `/api/kinds` | none | `[{id, name, unit}]`, sorted by name |
| `POST` | `/api/kinds` | `{"name": "Water meter reading", "unit": "m³"}` (`unit` optional/null) | `201 {id, name, unit}`; if the name already exists (case-insensitive), `200` with the existing one unchanged, so a double tap doesn't fail |
| `POST` | `/api/samples` | `{"kind_id": 1, "value": -3.5, "recorded_at": "2026-10-11T14:03:00Z"}` | `201 {id, kind_id, value, recorded_at}` |

- `recorded_at` is **optional**. If omitted, the server uses the current time. Either way it's truncated to the minute.
- Validation errors return `422 {"error": "..."}`: empty or too-long name, unit not in the list, non-finite value, unknown `kind_id`, unparseable timestamp. Malformed requests keep axum's status (400 bad JSON, 415 wrong content type, 422 wrong shape), also as `{"error": "..."}`.
- `GET /api/samples?kind_id=…` is deferred to the chart step.

## 5. Frontend (mobile first)

Designed at ~375px first, then widened with `sm:`/`md:` breakpoints.

```
┌───────────────────────────┐
│ time-series               │
│                           │
│ Type                      │
│ ┌───────────────────────┐ │
│ │ Body weight (kg)    ▾ │ │  ← native <select>
│ └───────────────────────┘ │     last option: "+ Add new type…"
│ Value                     │
│ ┌──────────────────┬────┐ │
│ │ 72.4             │ kg │ │  ← inputmode="decimal", unit suffix
│ └──────────────────┴────┘ │
│ When                      │
│ ┌───────────────────────┐ │
│ │ Now               [✎] │ │  ← tap to pick a date/time
│ └───────────────────────┘ │
│ ┌───────────────────────┐ │
│ │         Save          │ │  ← full width, h-12
│ └───────────────────────┘ │
│ ✓ Saved 72.4 · Body weight│  ← aria-live status
└───────────────────────────┘
```

**Type picker**
- A native `<select>` (opens the OS picker on phones), listing types from `GET /api/kinds`.
- Options show the unit in brackets when set: "Water meter reading (m³)".
- The last option is **"+ Add new type…"**. Choosing it shows a small inline panel in place of the select:

  ```
  Name  [ Water meter reading     ]
  Unit  [ m³ — cubic metre      ▾ ]   ← native <select> with <optgroup> per group
        [ Add ]  [ Cancel ]
  ```

  On Add, the app calls `POST /api/kinds`, refreshes the list and selects the new type.
- With no types yet, the form opens straight into add-type mode with the hint "Add your first type".
- The last-used type is remembered in `localStorage` and preselected.
- Renaming and deleting types are out of scope for now (see §8).

**Value**
- The selected type's unit is shown as a suffix inside the field.
- `type="text" inputmode="decimal"`, parsed by our own code. `type="number"` has inconsistent mobile keyboards and problems with comma decimals. Accepts `-`, `.`, and `,` as a decimal separator.

**When**
- Defaults to **"Now"**. In that state the client sends no `recorded_at` and the server stamps it, so a form left open for an hour doesn't save a stale time.
- Tapping it reveals a native `<input type="datetime-local">` (minute precision, OS picker), prefilled with the current local time, plus a "Reset to now" link.
- The client converts the local time to UTC (`new Date(local).toISOString()`) before sending.

**General**
- All inputs use at least 16px text, so iOS Safari doesn't zoom on focus. Shared shadcn-style input classes go in `components/ui/input.tsx`.
- Save: the button is disabled while submitting. On success, clear the value, keep the type, reset "When" to Now, and show a short confirmation ("Saved 72.4 kg · Body weight").
- Errors: client-side validation shows under each field; server errors show under the button.
- `App.tsx`: the form replaces the health-check button. The sample chart stays below the form as a placeholder until the chart step.
- Make sure `index.html` has `<meta name="viewport" content="width=device-width, initial-scale=1">`.

## 6. Code layout changes

```
migrations/0001_init.sql
src/main.rs          # wiring: pool, migrations, router
src/db.rs            # pool setup
src/units.rs         # UNITS list, GET /api/units
src/kinds.rs         # GET/POST /api/kinds
src/samples.rs       # POST /api/samples, validation, minute truncation
src/error.rs         # ApiError → 422/500 JSON
web/src/api.ts       # typed fetch helpers
web/src/components/SampleForm.tsx
web/src/components/KindPicker.tsx
web/src/components/ui/input.tsx
```

## 7. Steps

1. ✅ Add `sqlx` and `chrono`; write the migration; add `DATABASE_URL` config; run migrations on startup; add `data/` to `.gitignore`.
2. ✅ `ApiError`, the units list and endpoint, the kinds endpoints, and the samples endpoint, with validation.
3. ✅ Rust tests (`#[sqlx::test]`, a fresh migrated SQLite file per test): kind create/duplicate/validation (including unknown unit); sample insert with and without `recorded_at`; minute truncation; rejecting an unknown kind and NaN.
4. ✅ Frontend: `api.ts`, `input.tsx`, `KindPicker`, `SampleForm`; rework `App.tsx`.
5. Verify: `just lint`, `cargo test`, `curl` each endpoint, then try the form at phone width in the browser (add the first type, save samples with Now and with a back-dated time).

## 8. Deferred (noted for later)

- Per-type value rules.
- Free-text custom units. (✅ Changing a type's unit: done on the settings page, no conversion of existing values.)
- ✅ Type settings pages: `/kinds/new` and `/kinds/$kindId/settings` (name + unit), `PUT /api/kinds/{id}` (409 on a name clash, 404 unknown id). The form's inline add-type panel moved to `/kinds/new`.
- ✅ Landing page `/`: graph-paper backdrop + grid of type tiles. The sample form moved to `/kinds/$kindId/samples/new` (type from the URL, no dropdown).
- Deleting types (must decide what happens to that type's samples).
- ✅ Done (follow-up): `GET /api/samples?kind_id=`, TanStack Router with `/` (form) and `/kinds/$kindId` (chart + all samples, newest first). Saving navigates to `/kinds/<id>?saved=<sampleId>`, which confirms and highlights the new sample.
- Editing and deleting samples.

## 9. Open questions

None. Ready to implement on approval.
