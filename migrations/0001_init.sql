-- Types of thing being sampled ("kind" in code, "Type" in the UI).
CREATE TABLE kinds (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    unit       TEXT,
    created_at TEXT    NOT NULL
);

-- One measurement of a kind at a point in time (UTC, minute resolution).
CREATE TABLE samples (
    id          INTEGER PRIMARY KEY,
    kind_id     INTEGER NOT NULL REFERENCES kinds (id),
    value       REAL    NOT NULL,
    recorded_at TEXT    NOT NULL,
    created_at  TEXT    NOT NULL
);

CREATE INDEX samples_kind_recorded_at ON samples (kind_id, recorded_at);
