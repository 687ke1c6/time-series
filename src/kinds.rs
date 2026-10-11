use axum::{
    Json,
    extract::{
        Path, State,
        rejection::{JsonRejection, PathRejection},
    },
    http::StatusCode,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};

use crate::{db, error::ApiError, units};

const MAX_NAME_CHARS: usize = 100;

#[derive(Debug, Serialize, FromRow)]
pub struct Kind {
    pub id: i64,
    pub name: String,
    pub unit: Option<String>,
    /// Offer a forecast-to-zero on this kind's chart.
    pub forecast: bool,
}

#[derive(Debug, Deserialize)]
pub struct NewKind {
    pub name: String,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub forecast: bool,
}

pub async fn list(State(pool): State<SqlitePool>) -> Result<Json<Vec<Kind>>, ApiError> {
    let kinds =
        sqlx::query_as::<_, Kind>("SELECT id, name, unit, forecast FROM kinds ORDER BY name")
            .fetch_all(&pool)
            .await?;
    Ok(Json(kinds))
}

/// Trims and checks a kind's settings. An empty unit means "no unit".
fn validate(new: &NewKind) -> Result<(&str, Option<&str>), ApiError> {
    let name = new.name.trim();
    if name.is_empty() {
        return Err(ApiError::validation("name must not be empty"));
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err(ApiError::validation(format!(
            "name must be at most {MAX_NAME_CHARS} characters"
        )));
    }

    let unit = new.unit.as_deref().map(str::trim).filter(|u| !u.is_empty());
    if let Some(unit) = unit
        && !units::is_known(unit)
    {
        return Err(ApiError::validation(format!("unknown unit: {unit}")));
    }
    Ok((name, unit))
}

/// Creates a kind, or returns the existing one (200) if the name is already
/// taken, ignoring case, so a double submit is harmless.
pub async fn create(
    State(pool): State<SqlitePool>,
    payload: Result<Json<NewKind>, JsonRejection>,
) -> Result<(StatusCode, Json<Kind>), ApiError> {
    let Json(new) = payload?;

    let (name, unit) = validate(&new)?;

    let inserted = sqlx::query_as::<_, Kind>(
        "INSERT INTO kinds (name, unit, forecast, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (name) DO NOTHING
         RETURNING id, name, unit, forecast",
    )
    .bind(name)
    .bind(unit)
    .bind(new.forecast)
    .bind(db::timestamp(Utc::now()))
    .fetch_optional(&pool)
    .await?;

    if let Some(kind) = inserted {
        return Ok((StatusCode::CREATED, Json(kind)));
    }

    // `name` is COLLATE NOCASE, so this matches regardless of case.
    let existing =
        sqlx::query_as::<_, Kind>("SELECT id, name, unit, forecast FROM kinds WHERE name = ?")
            .bind(name)
            .fetch_one(&pool)
            .await?;
    Ok((StatusCode::OK, Json(existing)))
}

/// Replaces a kind's settings. Renaming onto another kind's name (ignoring
/// case) is a 409. Changing the unit doesn't convert existing sample values.
pub async fn update(
    State(pool): State<SqlitePool>,
    id: Result<Path<i64>, PathRejection>,
    payload: Result<Json<NewKind>, JsonRejection>,
) -> Result<Json<Kind>, ApiError> {
    let Path(id) = id?;
    let Json(new) = payload?;
    let (name, unit) = validate(&new)?;

    let updated = sqlx::query_as::<_, Kind>(
        "UPDATE kinds SET name = ?, unit = ?, forecast = ? WHERE id = ?
         RETURNING id, name, unit, forecast",
    )
    .bind(name)
    .bind(unit)
    .bind(new.forecast)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|err| match &err {
        sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
            ApiError::Conflict(format!("a type named \"{name}\" already exists"))
        }
        _ => err.into(),
    })?;

    updated
        .map(Json)
        .ok_or_else(|| ApiError::NotFound(format!("no type with id {id}")))
}
