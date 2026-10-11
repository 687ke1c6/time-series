FROM mcr.microsoft.com/devcontainers/rust:1-bookworm

# unzip is required by the Bun installer
RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*

USER vscode

# Bun 1.4.x (the Rust rewrite), pinned
ARG BUN_VERSION=1.4.3
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
ENV BUN_INSTALL=/home/vscode/.bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
