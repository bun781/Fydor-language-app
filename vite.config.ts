import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// Tauri expects a fixed dev port (see src-tauri/tauri.conf.json devUrl and
// scripts/tauri-dev.mjs, which overrides the port when 3001 is taken).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 3001,
    strictPort: true,
    host: "127.0.0.1"
  },
  build: {
    outDir: "dist",
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react") || id.includes("scheduler")) return "react";
          return "vendor";
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
