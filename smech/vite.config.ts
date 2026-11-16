import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    // The dev server is only ever bound to the local machine; allow the
    // sandbox preview host as well so the live preview keeps working.
    allowedHosts: ["localhost", ".localhost", ".e2b.app"],
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 3000,
  },
});
