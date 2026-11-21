import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { readFileSync } from "node:fs";

// A key written twice in a translation file silently keeps only the last one: the phone bar's short
// "Islas" once replaced the footer's "Islas en 3D" this way. Fail the build (and warn in dev) instead.
function i18nNoDuplicates() {
  const check = () => {
    for (const lang of ["es", "en"]) {
      const file = new URL(`./src/i18n/${lang}.json`, import.meta.url);
      const keys = [...readFileSync(file, "utf8").matchAll(/^\s*"([^"]+)"\s*:/gm)].map((m) => m[1]);
      const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
      if (dup.length) throw new Error(`src/i18n/${lang}.json has keys written twice: ${[...new Set(dup)].join(", ")}`);
    }
  };
  return { name: "i18n-no-duplicates", buildStart: check, handleHotUpdate: ({ file }: { file: string }) => void (file.includes("/i18n/") && check()) };
}

export default defineConfig({
  plugins: [
    i18nNoDuplicates(),
    react(),
    // Writes the Worker deploy config (static assets from the client build) that `cf deploy` uses.
    cloudflare(),
  ],
  // Build output (Cloudflare Build Output Spec) must not trigger dev reloads.
  server: { watch: { ignored: ["**/.cloudflare/**"] } },
  // Packages only reached through lazy chunks: pre-bundle them at startup, or the dev server finds
  // them mid-session, re-bundles, and the page ends up with two copies of React.
  optimizeDeps: { include: ["@overpunch/floodtext", "@react-three/drei", "@react-three/fiber", "three"] },
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
