//! Serving the app under a path prefix (`BASE_URL`), e.g. behind a reverse proxy.

use std::{env, path::Path};

use axum::{
    Router,
    http::StatusCode,
    response::{Html, IntoResponse},
    routing::{MethodRouter, get},
};

/// `BASE_URL` from the environment, normalized; defaults to "/".
pub fn from_env() -> String {
    normalize(&env::var("BASE_URL").unwrap_or_default())
}

/// Normalizes a path prefix to have leading and trailing slashes.
pub fn normalize(raw: &str) -> String {
    let trimmed = raw.trim().trim_matches('/');
    if trimmed.is_empty() {
        "/".into()
    } else {
        format!("/{trimmed}/")
    }
}

/// Serves `web_dist/index.html` with `<base href="$base_url">` injected, which
/// anchors the bundle's relative asset URLs and tells the client its prefix.
/// Read per request so a frontend rebuild doesn't need a server restart.
pub fn index_html(web_dist: &Path, base_url: &str) -> MethodRouter {
    let index_path = web_dist.join("index.html");
    let base_tag = format!(
        "<head>\n    <base href=\"{}\" />",
        base_url
            .replace('&', "&amp;")
            .replace('"', "&quot;")
            .replace('<', "&lt;")
    );
    get(move || async move {
        match tokio::fs::read_to_string(&index_path).await {
            Ok(html) => Html(html.replacen("<head>", &base_tag, 1)).into_response(),
            Err(_) => StatusCode::NOT_FOUND.into_response(),
        }
    })
}

/// Mounts `routes` under `base_url`; `index` also answers the bare prefix.
pub fn mount(routes: Router, base_url: &str, index: MethodRouter) -> Router {
    if base_url == "/" {
        routes
    } else {
        // `nest` matches "/prefix" and "/prefix/...", but not "/prefix/" itself.
        Router::new()
            .nest(base_url.trim_end_matches('/'), routes)
            .route(base_url, index)
    }
}
