# Scaffold Plan: time-series

Status: **DRAFT for review** (nothing has been scaffolded yet).

## 1. Goal

A Rust **axum** web server that serves a simple **SolidJS** single-page app, developed inside a **devcontainer**, with **shadcn**-style UI components. Tailscale is deliberately out of scope for now (see §7).

## 2. Version policy ("latest of everything")

Versions checked on 2026-10-11. We pin exact versions at scaffold time and record them here.

| Component | Latest found | How we pin |
|---|---|---|
| Rust (stable) | 1.99.0 | `rust-toolchain.toml` (`channel = "1.99.0"`), plus `rust-version` in Cargo.toml |
| axum | 0.8.9 | `Cargo.toml` + committed `Cargo.lock` |
| tokio | 1.53.2 | `Cargo.toml` |
| tower-http | 0.7.1 | `Cargo.toml` (static files, compression, tracing) |
| solid-js | 1.9.17 | `package.json` |
| vite | 8.3.4 | `package.json` |
| vite-plugin-solid | 2.11.14 | `package.json` |
| tailwindcss + @tailwindcss/vite | 4.3.3 | `package.json` |
| shadcn CLI | 4.21.4 | official CLI is React-only; we use the community Solid port (§6), version pinned at scaffold time |
| @observablehq/plot | 0.6.17 | `package.json` (pulls in d3 7.9.0 as a dependency) |
| Bun (Rust rewrite, 1.4.x) | 1.4.3 | `packageManager`/`engines` in package.json, `bun.lock` committed, pinned in the devcontainer |

At scaffold time we re-check each version with `cargo add` / `bun pm view` rather than trusting this table.

## 3. Repository layout

```
time-series/
├── SCAFFOLD_PLAN.md
├── README.md
├── .gitignore
├── .devcontainer/
│   ├── devcontainer.json
│   ├── Dockerfile
│   └── post-create.sh
├── rust-toolchain.toml
├── Cargo.toml                 # workspace root + server crate
├── Cargo.lock
├── src/
│   └── main.rs                # axum server
├── web/                       # SolidJS app (Vite + TypeScript)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── .prettierrc
│   ├── index.html
│   └── src/
│       ├── index.tsx
│       ├── App.tsx
│       ├── index.css          # tailwind entry
│       ├── lib/utils.ts       # cn() helper
│       └── components/ui/     # shadcn components (Button to start)
└── justfile                   # common tasks (dev, build, run)
```

Decision: a single Rust crate at the root and the frontend in `web/`. We can split into a Cargo workspace later if more crates appear.

## 4. Server (Rust + axum)

- `tokio` runtime, `axum` router, `tower-http` for `ServeDir` + SPA fallback to `index.html`, compression, and request tracing (`tracing`, `tracing-subscriber`).
- Routes:
  - `GET /api/health` returns `{"status":"ok"}`.
  - `/*` serves the built SolidJS bundle from `web/dist`, falling back to `index.html` for client-side routing.
- Config via env vars: `HOST` (default `0.0.0.0`), `PORT` (default `3000`), `WEB_DIST` (default `web/dist`).
- Graceful shutdown on SIGINT/SIGTERM.
- Dev vs prod:
  - **Dev:** run `vite` (HMR, port 5173) with a proxy of `/api` to axum (port 3000), and `cargo watch` for the server.
  - **Prod:** `bun run build` then `cargo run --release`, with axum serving `web/dist`. Embedding the dist into the binary (`rust-embed`) is a possible later step (deferred by decision).

## 5. Frontend (SolidJS)

- Vite + TypeScript + `vite-plugin-solid`.
- Tailwind CSS v4 via `@tailwindcss/vite`.
- Simple starter page: a heading, a shadcn `Button`, and a call to `/api/health` that displays the result, which proves the full stack is wired together.
- Charting: **Observable Plot** (`@observablehq/plot`) is installed up front. The starter page renders one small sample line chart (hard-coded time series) in a Solid component that calls `Plot.plot()` and mounts the returned element in `onMount`/`createEffect`. We may swap libraries later.
- Package manager and script runner: **Bun** (`bun install`, `bun run dev`, `bun run build`). Vite still handles dev/build.

## 6. shadcn

shadcn/ui officially targets React. For SolidJS the usual route is the community port **shadcn-solid / solid-ui**, which provides the same components (built on Kobalte + corvu) and its own CLI.

Plan: use that port, with `button` hand-written as the first component (Kobalte + cva + tailwind-merge, the same shape the port generates). `components.json` was not created because the port's CLI (`solidui-cli`) was not run; run `bunx solidui-cli@latest init` in `web/` before adding more components. Decision: the community port is approved.

## 7. Devcontainer

- Base: Microsoft Rust devcontainer image (Debian), or a custom Dockerfile built from it.
- Rust toolchain from `rust-toolchain.toml` (rustfmt, clippy, rust-analyzer components).
- Bun installed via the official install script, pinned to 1.4.3 (no Node feature needed).
- Extra tools: `cargo-watch`, `just`.
- **Tailscale: not included up front.** To reach the app from your tailnet, run Tailscale on the host machine and use the forwarded ports (axum binds `0.0.0.0`), or run `tailscale serve 3000` on the host. Adding it inside the container needs `/dev/net/tun`, extra capabilities and an auth key, which is extra complexity for little benefit. It can be added later as a separate step.
- Forwarded ports: 3000 (axum), 5173 (vite).
- VS Code extensions: rust-analyzer, Even Better TOML, Tailwind CSS IntelliSense, ESLint/Biome.
- `post-create.sh`: `bun install` in `web/`, `cargo fetch`.

## 8. Tooling and housekeeping

- `git init`, `.gitignore` (target, node_modules, web/dist, .env), initial commit.
- `justfile` tasks: `dev`, `build`, `run`, `fmt`, `lint`.
- Lint/format: `rustfmt`, `clippy -D warnings`, plus Prettier or Biome for the frontend.
- Out of scope for now: CI, Dependabot/Renovate, deployment Dockerfile, tests.

## 9. Scaffold steps (once approved)

1. `git init` and base files (.gitignore, README, rust-toolchain.toml).
2. Devcontainer files.
3. `cargo init` and add the axum stack at latest versions, then write the server.
4. Scaffold `web/` with Vite + Solid TS template, then add Tailwind v4.
5. Set up shadcn(-solid) and add `Button`.
6. Wire the `/api/health` call into the UI.
7. `justfile`, then verify: `cargo clippy`, `cargo build`, `web` build, run the server and curl `/` and `/api/health`.
8. Rebuild the devcontainer and confirm the app is reachable on the forwarded ports.

## 10. Decisions

- shadcn: community Solid port is fine.
- Serving: `web/dist` from disk. `rust-embed` is deferred until later.
- Extras (CI, Dependabot/Renovate, Dockerfile, tests): none for now.
- Charting: Observable Plot.
- Tailscale: not included up front.
- Package manager: Bun 1.4.x (the Rust rewrite).

## 11. Open questions

None at the moment.
