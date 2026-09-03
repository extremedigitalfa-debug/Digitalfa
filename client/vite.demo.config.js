import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Standalone demo build: everything inlined into ONE html file, running the
// in-memory mock API. Output is a CLASSIC (IIFE) script — no ES modules, no
// top-level await — so it runs from a double-clicked file:// or inside a
// sandboxed preview panel in any browser, including stricter ones (Safari).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: { "import.meta.env.VITE_DEMO": JSON.stringify("1") },
  build: {
    outDir: "dist-demo",
    target: "es2015",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { format: "iife", inlineDynamicImports: true } },
  },
});
