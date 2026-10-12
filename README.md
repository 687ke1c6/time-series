# time-series

Rust (axum) web server serving a SolidJS app. See [SCAFFOLD_PLAN.md](SCAFFOLD_PLAN.md) for the stack and decisions.

## Develop

Open in the devcontainer, then:

```sh
just dev    # Vite on :5173 (proxies /api) + cargo-watch on :3000
```

## Production-style run

```sh
just run    # bun run build, then cargo run --release on :3000
```

Environment variables: `HOST` (default `0.0.0.0`), `PORT` (default `3000`), `WEB_DIST` (default `web/dist`), `DATABASE_URL` (default `sqlite://data/time-series.db?mode=rwc`), `BASE_URL` (default `/`; the path prefix when served behind a reverse proxy, e.g. `/time-series/`), `RUST_LOG`.

## Docker

```sh
docker build -t time-series .
docker run -p 3000:3000 -v time-series-data:/data time-series
```

Bun web + Rust alpine builders, Alpine runner; the image holds a static musl binary plus the frontend bundle. The SQLite database lives in the `/data` volume. Set `BASE_URL` (with a leading slash) to serve under a path prefix.
