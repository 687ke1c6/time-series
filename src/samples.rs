use axum::{
    Json,
    extract::{
        Query, State,
        rejection::{JsonRejection, QueryRejection},
    },
    http::StatusCode,
};
use chrono::{DateTime, DurationRound, TimeDelta, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};

use crate::{db, error::ApiError};

#[derive(Debug, Serialize, FromRow)]
pub struct Sample {
    pub id: i64,
    pub kind_id: i64,
    pub value: f64,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct NewSample {
    pub kind_id: i64,
    pub value: f64,
    /// Any RFC 3339 offset is accepted and converted to UTC. Omitted means now.
    #[serde(default)]
    pub recorded_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct ListParams {
    pub kind_id: i64,
}

/// All samples of one kind, oldest first (the order the chart draws them).
pub async fn list(
    State(pool): State<SqlitePool>,
    params: Result<Query<ListParams>, QueryRejection>,
) -> Result<Json<Vec<Sample>>, ApiError> {
    let Query(params) = params?;
    let samples = sqlx::query_as::<_, Sample>(
        "SELECT id, kind_id, value, recorded_at FROM samples
         WHERE kind_id = ?
         ORDER BY recorded_at, id",
    )
    .bind(params.kind_id)
    .fetch_all(&pool)
    .await?;
    Ok(Json(samples))
}

/// Samples are recorded at minute resolution.
fn truncate_to_minute(t: DateTime<Utc>) -> DateTime<Utc> {
    t.duration_trunc(TimeDelta::minutes(1))
        .expect("a minute always fits in a DateTime")
}

pub async fn create(
    State(pool): State<SqlitePool>,
    payload: Result<Json<NewSample>, JsonRejection>,
) -> Result<(StatusCode, Json<Sample>), ApiError> {
    let Json(new) = payload?;

    if !new.value.is_finite() {
        return Err(ApiError::validation("value must be a finite number"));
    }

    let now = Utc::now();
    let recorded_at = truncate_to_minute(new.recorded_at.unwrap_or(now));

    let sample = sqlx::query_as::<_, Sample>(
        "INSERT INTO samples (kind_id, value, recorded_at, created_at) VALUES (?, ?, ?, ?)
         RETURNING id, kind_id, value, recorded_at",
    )
    .bind(new.kind_id)
    .bind(new.value)
    .bind(db::timestamp(recorded_at))
    .bind(db::timestamp(now))
    .fetch_one(&pool)
    .await
    .map_err(|err| match &err {
        sqlx::Error::Database(db_err) if db_err.is_foreign_key_violation() => {
            ApiError::validation(format!("unknown kind_id: {}", new.kind_id))
        }
        _ => err.into(),
    })?;

    Ok((StatusCode::CREATED, Json(sample)))
}
