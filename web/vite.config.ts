import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  // Relative asset URLs, so the bundle works under any path prefix. The server
  // injects <base href="$BASE_URL"> into index.html to anchor them.
  base: "./",
  resolve: {
    // Vite resolves a leading "/" from the project root (web/).
    alias: { "@": "/src" },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: { "/api": "http://localhost:3000" },
  },
});
