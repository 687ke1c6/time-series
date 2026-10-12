# syntax=docker/dockerfile:1
#
# Three stages: Bun builds the SolidJS bundle, Rust builds a static musl
# server binary (the two run in parallel), and the runner is bare Alpine with
# just those two artifacts.
#
#   docker build -t time-series .
#   docker run -p 3000:3000 -v time-series-data:/data time-series
#
# Serve under a path prefix with `-e BASE_URL=/time-series/`.

# Pinned to match rust-toolchain.toml, the devcontainer, and each other.
ARG ALPINE_VERSION=3.22
ARG RUST_VERSION=1.99
ARG BUN_VERSION=1.4.3

# ---- web: SolidJS bundle ----------------------------------------------------
FROM oven/bun:${BUN_VERSION}-alpine AS web

WORKDIR /web
# Deps first so they cache independently of source changes.
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web ./
RUN bun run build

# ---- server: static musl binary ---------------------------------------------
FROM rust:${RUST_VERSION}-alpine${ALPINE_VERSION} AS server

# musl-dev for the bundled SQLite (gcc ships with the image).
RUN apk add --no-cache musl-dev

WORKDIR /src
# rust-toolchain.toml is left out: the image's toolchain is already pinned, and
# the file would make rustup fetch rustfmt/clippy/rust-analyzer.
COPY Cargo.toml Cargo.lock build.rs ./
COPY migrations migrations
COPY src src
# Cache mounts keep the registry and target dir across builds; the binary is
# copied out since the mounted target dir isn't part of the image.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/target \
    cargo build --release --locked \
    && cp target/release/time-series /time-series

# ---- runner -----------------------------------------------------------------
FROM alpine:${ALPINE_VERSION} AS runner

RUN addgroup -S app && adduser -S -G app -H -h /app app \
    && mkdir -p /data && chown app:app /data

WORKDIR /app
COPY --from=server /time-series /app/time-series
COPY --from=web /web/dist /app/web/dist

ENV HOST=0.0.0.0 \
    PORT=3000 \
    BASE_URL=/ \
    WEB_DIST=/app/web/dist \
    DATABASE_URL=sqlite:///data/time-series.db?mode=rwc \
    RUST_LOG=info

USER app
VOLUME /data
EXPOSE 3000

# busybox wget; BASE_URL needs a leading slash for this to resolve.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -qO- "http://127.0.0.1:${PORT}${BASE_URL%/}/api/health" >/dev/null || exit 1

# The server handles SIGTERM itself for graceful shutdown.
CMD ["/app/time-series"]
