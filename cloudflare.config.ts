import { defineConfig } from "cf/config";

// Static-assets Worker (no script). `cf build` runs `vite build`; the Cloudflare Vite plugin
// (v2 beta) writes the assets and this config to .cloudflare/output.
// Deployed by Workers Builds on push to main. A push to any other branch only uploads a preview
// version (alias = branch name, previewUrls below) without deploying it.
export default defineConfig({
  worker: {
    name: "reefquest",
    compatibilityDate: "2026-11-01",
    observability: {
      enabled: true,
    },
    assets: {
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "single-page-application",
    },
    domains: ["reefquest.todosenlaweb.com"],
    workersDev: false,
    previewUrls: true,
  },
});
