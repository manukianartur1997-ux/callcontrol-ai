// Builds the cabinet SPA (saas/cabinet/) into dist/app/.
//
// Runs AFTER build-pages.js in `npm run build` — build-pages wipes dist/ at
// its start, so the order is load-bearing, not stylistic.
//
// The cabinet uses hash routing on purpose: the Worker serves dist/ with
// single-page-application fallback that rewrites unknown paths to the ROOT
// index.html (the landing), not to /app/index.html — so /app/calls as a real
// path would render the landing. /app/#/calls never leaves /app/.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "saas/cabinet",
  base: "/app/",
  plugins: [react()],
  build: {
    outDir: "../../dist/app",
    emptyOutDir: true
  }
});
