mod db;
mod error;
mod kinds;
mod samples;
#[cfg(test)]
mod tests;
mod units;

use std::{env, net::SocketAddr, path::PathBuf};

use axum::{
    Json, Router,
    routing::{get, put},
};
use serde::Serialize;
use sqlx::SqlitePool;
use tokio::{net::TcpListener, signal};
use tower_http::{
    compression::CompressionLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
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

    let pool = db::connect(&database_url)
        .await
        .expect("failed to open database");
    tracing::info!("database ready at {database_url}");

    // Serve the built SolidJS bundle; unknown paths fall back to index.html
    // so client-side routing works.
    let spa = ServeDir::new(&web_dist).fallback(ServeFile::new(web_dist.join("index.html")));

    let app = api_routes()
        .fallback_service(spa)
        .with_state(pool)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = format!("{host}:{port}")
        .parse()
        .expect("HOST and PORT must form a valid socket address");
    let listener = TcpListener::bind(addr).await.expect("failed to bind");
    tracing::info!("listening on http://{addr}, serving {}", web_dist.display());

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server error");
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
