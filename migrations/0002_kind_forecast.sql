-- Per-kind setting: offer a forecast-to-zero on the chart.
ALTER TABLE kinds ADD COLUMN forecast BOOLEAN NOT NULL DEFAULT FALSE;
