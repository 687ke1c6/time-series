mod base_url;
mod db;
mod error;
mod kinds;
mod samples;
mod shutdown;
#[cfg(test)]
mod tests;
mod units;

use std::{
    env,
    net::SocketAddr,
    path::{Path, PathBuf},
};

use axum::{
    Json, Router,
    routing::{get, put},
};
use serde::Serialize;
use sqlx::SqlitePool;
use tokio::net::TcpListener;
use tower_http::{compression::CompressionLayer, services::ServeDir, trace::TraceLayer};
use tracing_subscriber::EnvFilter;

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

fn api_routes() -> Router<SqlitePool> {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/units", get(units::list))
        .route("/api/kinds", get(kinds::list).post(kinds::create))
        .route("/api/kinds/{id}", put(kinds::update))
        .route("/api/samples", get(samples::list).post(samples::create))
}

/// The full app: API plus the built SolidJS bundle, mounted under `base_url`.
fn app(pool: SqlitePool, web_dist: &Path, base_url: &str) -> Router {
    let index = base_url::index_html(web_dist, base_url);

    // Unknown paths (and "/") fall back to index.html so client-side routing works.
    let spa = ServeDir::new(web_dist)
        .append_index_html_on_directories(false)
        .fallback(index.clone());

    let routes = api_routes().fallback_service(spa).with_state(pool);
    base_url::mount(routes, base_url, index)
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into());
    let port = env::var("PORT").unwrap_or_else(|_| "3000".into());
    let web_dist = PathBuf::from(env::var("WEB_DIST").unwrap_or_else(|_| "web/dist".into()));
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| db::DEFAULT_DATABASE_URL.into());
    let base_url = base_url::from_env();
    println!("Starting server with configuration:");
    println!("  HOST: {host}");
    println!("  PORT: {port}");
    println!("  WEB_DIST: {}", web_dist.display());
    println!("  BASE_URL: {base_url}");

    let pool = db::connect(&database_url)
        .await
        .expect("failed to open database");
    tracing::info!("database ready at {database_url}");

    let app = app(pool, &web_dist, &base_url)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = format!("{host}:{port}")
        .parse()
        .expect("HOST and PORT must form a valid socket address");
    let listener = TcpListener::bind(addr).await.expect("failed to bind");
    tracing::info!(
        "listening on http://{addr}{base_url}, serving {}",
        web_dist.display()
    );

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown::signal())
        .await
        .expect("server error");
}
