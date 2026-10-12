# List tasks
default:
    @just --list

# Install frontend dependencies
install:
    cd web && bun install

# Dev: Vite (5173, proxies /api) and cargo-watch (3000) together
dev:
    cd web && bun run dev & cargo watch -x run

# Build the frontend bundle
build:
    cd web && bun run build
    cargo build --release
    rm -rf dist
    mkdir -p dist/web
    cp target/release/time-series dist/
    cp -r web/dist dist/web/dist

# Build the frontend, then run the server in release mode
run: build
    cargo run --release

# Run the Rust tests
test:
    cargo test

fmt:
    cargo fmt
    cd web && bun run fmt

lint:
    cargo clippy --all-targets -- -D warnings
    cd web && bun run typecheck
