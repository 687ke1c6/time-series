//! API tests. Each `#[sqlx::test]` gets its own fresh, migrated SQLite database.

use std::sync::atomic::{AtomicUsize, Ordering};

use axum::{
    body::{Body, to_bytes},
    http::{Method, Request, StatusCode, header},
};
use chrono::{DateTime, DurationRound, TimeDelta, Timelike, Utc};
use serde_json::{Value, json};
use sqlx::SqlitePool;
use tower::ServiceExt;

use crate::{api_routes, app, base_url};

/// Sends one request through the API router and returns status + JSON body.
async fn call(
    pool: &SqlitePool,
    method: Method,
    uri: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri);
    let body = match body {
        Some(json) => {
            req = req.header(header::CONTENT_TYPE, "application/json");
            Body::from(json.to_string())
        }
        None => Body::empty(),
    };
    send(pool, req.body(body).unwrap()).await
}

async fn send(pool: &SqlitePool, req: Request<Body>) -> (StatusCode, Value) {
    let res = api_routes()
        .with_state(pool.clone())
        .oneshot(req)
        .await
        .unwrap();
    let status = res.status();
    let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

async fn post(pool: &SqlitePool, uri: &str, body: Value) -> (StatusCode, Value) {
    call(pool, Method::POST, uri, Some(body)).await
}

async fn get(pool: &SqlitePool, uri: &str) -> (StatusCode, Value) {
    call(pool, Method::GET, uri, None).await
}

async fn create_kind(pool: &SqlitePool, name: &str, unit: Option<&str>) -> i64 {
    let (status, body) = post(pool, "/api/kinds", json!({ "name": name, "unit": unit })).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    body["id"].as_i64().unwrap()
}

fn parse_time(v: &Value) -> DateTime<Utc> {
    v.as_str().unwrap().parse().unwrap()
}

// ---- units ----

#[sqlx::test]
async fn units_are_grouped_and_end_with_other(pool: SqlitePool) {
    let (status, body) = get(&pool, "/api/units").await;
    assert_eq!(status, StatusCode::OK);

    let groups = body.as_array().unwrap();
    assert_eq!(groups[0]["group"], "Volume");
    assert_eq!(groups.last().unwrap()["group"], "Other");
    assert_eq!(groups.last().unwrap()["units"][0]["symbol"], "units");
}

// ---- kinds ----

#[sqlx::test]
async fn kinds_start_empty(pool: SqlitePool) {
    assert_eq!(get(&pool, "/api/kinds").await, (StatusCode::OK, json!([])));
}

#[sqlx::test]
async fn create_kind_trims_name_and_keeps_unit(pool: SqlitePool) {
    let (status, body) = post(
        &pool,
        "/api/kinds",
        json!({ "name": "  Water meter reading ", "unit": "m³" }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["name"], "Water meter reading");
    assert_eq!(body["unit"], "m³");
}

#[sqlx::test]
async fn kind_unit_is_optional(pool: SqlitePool) {
    let (_, missing) = post(&pool, "/api/kinds", json!({ "name": "Mood" })).await;
    let (_, empty) = post(&pool, "/api/kinds", json!({ "name": "Sleep", "unit": "" })).await;
    let (_, null) = post(&pool, "/api/kinds", json!({ "name": "Rain", "unit": null })).await;
    for body in [missing, empty, null] {
        assert_eq!(body["unit"], Value::Null, "{body}");
    }
}

#[sqlx::test]
async fn duplicate_kind_name_returns_existing_ignoring_case(pool: SqlitePool) {
    let id = create_kind(&pool, "Body weight", Some("kg")).await;

    let (status, body) = post(
        &pool,
        "/api/kinds",
        json!({ "name": "BODY WEIGHT", "unit": "lb" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!({ "id": id, "name": "Body weight", "unit": "kg", "forecast": false })
    );

    let (_, all) = get(&pool, "/api/kinds").await;
    assert_eq!(all.as_array().unwrap().len(), 1);
}

#[sqlx::test]
async fn kinds_are_listed_by_name_ignoring_case(pool: SqlitePool) {
    for name in ["water", "Body weight", "energy"] {
        create_kind(&pool, name, None).await;
    }
    let (_, body) = get(&pool, "/api/kinds").await;
    let names: Vec<_> = body
        .as_array()
        .unwrap()
        .iter()
        .map(|k| k["name"].clone())
        .collect();
    assert_eq!(names, ["Body weight", "energy", "water"]);
}

#[sqlx::test]
async fn kind_validation(pool: SqlitePool) {
    let ok_name = "a".repeat(100);
    let long_name = "a".repeat(101);
    let cases = [
        (json!({ "name": "   " }), "name must not be empty"),
        (
            json!({ "name": long_name }),
            "name must be at most 100 characters",
        ),
        (
            json!({ "name": "X", "unit": "parsecs" }),
            "unknown unit: parsecs",
        ),
    ];
    for (input, error) in cases {
        let (status, body) = post(&pool, "/api/kinds", input).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(body["error"], error);
    }

    let (status, _) = post(&pool, "/api/kinds", json!({ "name": ok_name })).await;
    assert_eq!(status, StatusCode::CREATED);
}

async fn put(pool: &SqlitePool, uri: &str, body: Value) -> (StatusCode, Value) {
    call(pool, Method::PUT, uri, Some(body)).await
}

#[sqlx::test]
async fn update_kind_renames_and_changes_unit(pool: SqlitePool) {
    let id = create_kind(&pool, "Water", Some("L")).await;

    let (status, body) = put(
        &pool,
        &format!("/api/kinds/{id}"),
        json!({ "name": " Water meter ", "unit": "m³" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body,
        json!({ "id": id, "name": "Water meter", "unit": "m³", "forecast": false })
    );

    let (_, body) = put(
        &pool,
        &format!("/api/kinds/{id}"),
        json!({ "name": "Water meter", "unit": "" }),
    )
    .await;
    assert_eq!(body["unit"], Value::Null);

    let (_, all) = get(&pool, "/api/kinds").await;
    assert_eq!(
        all,
        json!([{ "id": id, "name": "Water meter", "unit": null, "forecast": false }])
    );
}

#[sqlx::test]
async fn update_kind_allows_changing_only_case(pool: SqlitePool) {
    let id = create_kind(&pool, "body weight", Some("kg")).await;
    let (status, body) = put(
        &pool,
        &format!("/api/kinds/{id}"),
        json!({ "name": "Body Weight", "unit": "kg" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["name"], "Body Weight");
}

#[sqlx::test]
async fn update_kind_rejects_another_kinds_name(pool: SqlitePool) {
    create_kind(&pool, "Water", None).await;
    let id = create_kind(&pool, "Energy", None).await;

    let (status, body) = put(
        &pool,
        &format!("/api/kinds/{id}"),
        json!({ "name": "WATER" }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"], "a type named \"WATER\" already exists");
}

#[sqlx::test]
async fn update_kind_validates_like_create(pool: SqlitePool) {
    let id = create_kind(&pool, "Water", None).await;
    let uri = format!("/api/kinds/{id}");
    for (input, error) in [
        (json!({ "name": "  " }), "name must not be empty"),
        (
            json!({ "name": "Water", "unit": "parsecs" }),
            "unknown unit: parsecs",
        ),
    ] {
        let (status, body) = put(&pool, &uri, input).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(body["error"], error);
    }
}

#[sqlx::test]
async fn update_unknown_or_bad_kind_id(pool: SqlitePool) {
    let (status, body) = put(&pool, "/api/kinds/99", json!({ "name": "X" })).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "no type with id 99");

    let (status, body) = put(&pool, "/api/kinds/abc", json!({ "name": "X" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].is_string());
}

#[sqlx::test]
async fn kind_forecast_defaults_off_and_can_be_set(pool: SqlitePool) {
    let (_, plain) = post(&pool, "/api/kinds", json!({ "name": "Mood" })).await;
    assert_eq!(plain["forecast"], false);

    let (status, water) = post(
        &pool,
        "/api/kinds",
        json!({ "name": "Water tank", "unit": "L", "forecast": true }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(water["forecast"], true);

    let (_, all) = get(&pool, "/api/kinds").await;
    let forecasts: Vec<_> = all
        .as_array()
        .unwrap()
        .iter()
        .map(|k| k["forecast"].clone())
        .collect();
    assert_eq!(forecasts, [json!(false), json!(true)]);
}

#[sqlx::test]
async fn update_kind_toggles_forecast(pool: SqlitePool) {
    let id = create_kind(&pool, "Water tank", Some("L")).await;
    let uri = format!("/api/kinds/{id}");

    let (_, on) = put(
        &pool,
        &uri,
        json!({ "name": "Water tank", "unit": "L", "forecast": true }),
    )
    .await;
    assert_eq!(on["forecast"], true);

    // PUT replaces the settings, so an omitted forecast switches it off.
    let (_, off) = put(&pool, &uri, json!({ "name": "Water tank", "unit": "L" })).await;
    assert_eq!(off["forecast"], false);
}

#[sqlx::test]
async fn duplicate_kind_keeps_existing_forecast(pool: SqlitePool) {
    post(
        &pool,
        "/api/kinds",
        json!({ "name": "Water tank", "forecast": true }),
    )
    .await;
    let (status, body) = post(
        &pool,
        "/api/kinds",
        json!({ "name": "water tank", "forecast": false }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["forecast"], true);
}

// ---- samples ----

#[sqlx::test]
async fn sample_without_time_uses_now_truncated_to_minute(pool: SqlitePool) {
    let kind_id = create_kind(&pool, "Steps", Some("steps")).await;

    let before = Utc::now().duration_trunc(TimeDelta::minutes(1)).unwrap();
    let (status, body) = post(
        &pool,
        "/api/samples",
        json!({ "kind_id": kind_id, "value": 8042 }),
    )
    .await;
    let after = Utc::now();

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["kind_id"], kind_id);
    assert_eq!(body["value"], 8042.0);
    let recorded_at = parse_time(&body["recorded_at"]);
    assert!(before <= recorded_at && recorded_at <= after);
    assert_eq!((recorded_at.second(), recorded_at.nanosecond()), (0, 0));
}

#[sqlx::test]
async fn sample_time_is_converted_to_utc_and_truncated(pool: SqlitePool) {
    let kind_id = create_kind(&pool, "Water", Some("m³")).await;

    let (status, body) = post(
        &pool,
        "/api/samples",
        json!({ "kind_id": kind_id, "value": 1234.567, "recorded_at": "2026-10-01T09:15:42.9+02:00" }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["recorded_at"], "2026-10-01T07:15:00Z");
}

#[sqlx::test]
async fn sample_accepts_negative_and_decimal_values(pool: SqlitePool) {
    let kind_id = create_kind(&pool, "Temperature", Some("°C")).await;
    for value in [-3.5, 0.0, 0.001, -1e12] {
        let (status, body) = post(
            &pool,
            "/api/samples",
            json!({ "kind_id": kind_id, "value": value }),
        )
        .await;
        assert_eq!(status, StatusCode::CREATED);
        assert_eq!(body["value"], value);
    }
}

#[sqlx::test]
async fn sample_timestamps_are_stored_as_utc_rfc3339(pool: SqlitePool) {
    let kind_id = create_kind(&pool, "Water", None).await;
    post(
        &pool,
        "/api/samples",
        json!({ "kind_id": kind_id, "value": 1, "recorded_at": "2026-01-02T03:04:05-05:00" }),
    )
    .await;

    let (recorded_at, created_at): (String, String) =
        sqlx::query_as("SELECT recorded_at, created_at FROM samples")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(recorded_at, "2026-01-02T08:04:00Z");
    assert!(
        created_at.ends_with('Z') && created_at.len() == 20,
        "{created_at}"
    );
}

#[sqlx::test]
async fn sample_with_unknown_kind_is_rejected(pool: SqlitePool) {
    let (status, body) = post(&pool, "/api/samples", json!({ "kind_id": 99, "value": 1 })).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["error"], "unknown kind_id: 99");
}

#[sqlx::test]
async fn sample_with_bad_fields_is_rejected(pool: SqlitePool) {
    let kind_id = create_kind(&pool, "Water", None).await;
    let cases = [
        json!({ "kind_id": kind_id, "value": "abc" }),
        json!({ "kind_id": kind_id }),
        json!({ "kind_id": kind_id, "value": 1, "recorded_at": "yesterday" }),
    ];
    for input in cases {
        let (status, body) = post(&pool, "/api/samples", input).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
        assert!(body["error"].is_string(), "{body}");
    }
}

#[sqlx::test]
async fn samples_are_listed_per_kind_oldest_first(pool: SqlitePool) {
    let water = create_kind(&pool, "Water", Some("m³")).await;
    let energy = create_kind(&pool, "Energy", Some("kWh")).await;
    for (kind_id, value, at) in [
        (water, 2.0, "2026-10-02T08:00:00Z"),
        (energy, 99.0, "2026-10-01T08:00:00Z"),
        (water, 1.0, "2026-10-01T08:00:00Z"),
        (water, 3.0, "2026-10-03T08:00:00Z"),
    ] {
        post(
            &pool,
            "/api/samples",
            json!({ "kind_id": kind_id, "value": value, "recorded_at": at }),
        )
        .await;
    }

    let (status, body) = get(&pool, &format!("/api/samples?kind_id={water}")).await;
    assert_eq!(status, StatusCode::OK);
    let values: Vec<_> = body
        .as_array()
        .unwrap()
        .iter()
        .map(|s| s["value"].as_f64().unwrap())
        .collect();
    assert_eq!(values, [1.0, 2.0, 3.0]);
    assert!(
        body.as_array()
            .unwrap()
            .iter()
            .all(|s| s["kind_id"] == water)
    );
}

#[sqlx::test]
async fn listing_samples_of_unknown_kind_is_empty(pool: SqlitePool) {
    assert_eq!(
        get(&pool, "/api/samples?kind_id=99").await,
        (StatusCode::OK, json!([]))
    );
}

#[sqlx::test]
async fn listing_samples_requires_a_numeric_kind_id(pool: SqlitePool) {
    for uri in ["/api/samples", "/api/samples?kind_id=abc"] {
        let (status, body) = get(&pool, uri).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{uri}");
        assert!(body["error"].is_string(), "{body}");
    }
}

// ---- malformed requests ----

#[sqlx::test]
async fn malformed_requests_keep_their_status(pool: SqlitePool) {
    let no_content_type = Request::post("/api/samples")
        .body(Body::from(r#"{"kind_id":1,"value":1}"#))
        .unwrap();
    let (status, body) = send(&pool, no_content_type).await;
    assert_eq!(status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    assert!(body["error"].is_string());

    let bad_json = Request::post("/api/samples")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from("{bad"))
        .unwrap();
    let (status, body) = send(&pool, bad_json).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].is_string());
}

#[test]
fn base_url_is_normalized() {
    assert_eq!(base_url::normalize(""), "/");
    assert_eq!(base_url::normalize("/"), "/");
    assert_eq!(base_url::normalize("ts"), "/ts/");
    assert_eq!(base_url::normalize("/apps/ts"), "/apps/ts/");
    assert_eq!(base_url::normalize("/apps/ts/"), "/apps/ts/");
}

/// Sends a GET through the full app with a stub bundle, returning status + body text.
async fn get_app(pool: &SqlitePool, base_url: &str, uri: &str) -> (StatusCode, String) {
    // A directory per call, since tests run in parallel.
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    let web_dist = std::env::temp_dir().join(format!(
        "time-series-dist-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir_all(web_dist.join("assets")).unwrap();
    std::fs::write(web_dist.join("index.html"), "<html><head></head></html>").unwrap();
    std::fs::write(web_dist.join("assets/app.js"), "// app").unwrap();

    let req = Request::builder().uri(uri).body(Body::empty()).unwrap();
    let res = app(pool.clone(), &web_dist, base_url)
        .oneshot(req)
        .await
        .unwrap();
    let status = res.status();
    let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
    (status, String::from_utf8(bytes.to_vec()).unwrap())
}

#[sqlx::test]
async fn serves_under_base_url(pool: SqlitePool) {
    let index = r#"<html><head>
    <base href="/apps/ts/" /></head></html>"#;
    for uri in ["/apps/ts", "/apps/ts/", "/apps/ts/kinds/1"] {
        assert_eq!(
            get_app(&pool, "/apps/ts/", uri).await,
            (StatusCode::OK, index.into()),
            "{uri}"
        );
    }
    assert_eq!(
        get_app(&pool, "/apps/ts/", "/apps/ts/assets/app.js")
            .await
            .1,
        "// app"
    );
    let (status, body) = get_app(&pool, "/apps/ts/", "/apps/ts/api/health").await;
    assert_eq!(
        (status, body.as_str()),
        (StatusCode::OK, r#"{"status":"ok"}"#)
    );
    assert_eq!(
        get_app(&pool, "/apps/ts/", "/api/health").await.0,
        StatusCode::NOT_FOUND
    );
}

#[sqlx::test]
async fn serves_at_root_by_default(pool: SqlitePool) {
    let (status, body) = get_app(&pool, "/", "/kinds/1").await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains(r#"<base href="/" />"#), "{body}");
    assert_eq!(get_app(&pool, "/", "/api/health").await.0, StatusCode::OK);
}
