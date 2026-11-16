import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Log the Host header of preview traffic.
 *
 * The live preview is reached through a platform-owned proxy whose hostname is
 * assigned by the host, so seeing which hostname actually arrives is the
 * fastest way to confirm the preview route is allowed and registered.
 * Local development traffic is ignored to keep the log quiet.
 */
function previewHostLogger(): Plugin {
  return {
    name: "arena-preview-host-logger",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const host = req.headers.host ?? "";
        if (host && !/^(localhost|127\.0\.0\.1|\[::1\]|169\.254\.)/.test(host)) {
          console.warn(`[preview] ${host}${req.url ?? ""}`);
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), previewHostLogger()],
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
