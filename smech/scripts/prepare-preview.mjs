import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Publish the production build as a single, self-contained page.
 *
 * The Vite build inlines every asset (JS, CSS, Three.js) into one HTML file,
 * so it can be served straight from a static host or a raw file URL without
 * any server-side configuration.
 */
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(appRoot, "dist/index.html");
const outputDir = resolve(appRoot, "../preview");
const target = resolve(outputDir, "index.html");

mkdirSync(outputDir, { recursive: true });
copyFileSync(source, target);

const size = statSync(target).size;
console.log(`preview/index.html written (${(size / 1024).toFixed(2)} kB)`);
