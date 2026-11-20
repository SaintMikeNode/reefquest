import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    // Writes the Worker deploy config (static assets from the client build) that `cf deploy` uses.
    cloudflare(),
  ],
  // Build output (Cloudflare Build Output Spec) must not trigger dev reloads.
  server: { watch: { ignored: ["**/.cloudflare/**"] } },
  build: {
    target: "es2022",
    // Chunks: index (menu, i18n, 2D map — must stay small, it's the first thing phones load)
    // → engine-3d (three + R3F) → each island scene, fetched only when an island is opened.
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "engine-3d", test: /node_modules[\\/](three|@react-three[\\/]fiber|react-reconciler|its-fine|suspend-react)[\\/]/ }],
        },
      },
    },
  },
});
