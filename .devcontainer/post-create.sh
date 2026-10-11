#!/usr/bin/env bash
set -euo pipefail

# Installs the toolchain pinned in rust-toolchain.toml
rustup show

cargo install --locked cargo-watch just
cargo fetch

(cd web && bun install)
