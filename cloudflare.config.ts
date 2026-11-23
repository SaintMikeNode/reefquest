import { bindings, defineConfig } from "cf/config";

// Static-assets Worker with a small script for /video/* only (worker/index.ts): the assets server
// ignores byte-range requests, which Safari needs to play <video>, so the script answers them.
// Everything else is served straight from the assets. `cf build` runs `vite build`; the Cloudflare Vite plugin
// (v2 beta) writes the assets and this config to .cloudflare/output.
// Deployed by Workers Builds on push to main. A push to any other branch only uploads a preview
// version (alias = branch name, previewUrls below) without deploying it.
export default defineConfig({
  worker: {
    name: "reefquest",
    compatibilityDate: "2026-11-01",
    entrypoint: "./worker/index.ts",
    env: {
      ASSETS: bindings.assets(),
    },
    observability: {
      enabled: true,
    },
    assets: {
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/video/*"],
    },
    domains: ["reefquest.todosenlaweb.com"],
    workersDev: false,
    previewUrls: true,
  },
});
