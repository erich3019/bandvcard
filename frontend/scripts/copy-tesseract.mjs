// Copies the Tesseract.js worker, WebAssembly cores and language data into public/tesseract,
// so OCR runs without loading anything from a CDN. Runs before `dev` and `build`.
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modules = join(root, "node_modules");
const target = join(root, "public", "tesseract");

mkdirSync(join(target, "core"), { recursive: true });
mkdirSync(join(target, "lang"), { recursive: true });

cpSync(join(modules, "tesseract.js", "dist", "worker.min.js"), join(target, "worker.min.js"));

const core = join(modules, "tesseract.js-core");
for (const file of readdirSync(core).filter((name) => name.endsWith(".wasm.js"))) {
  cpSync(join(core, file), join(target, "core", file));
}

// Must match OCR_LANGUAGES in src/lib/ocr.ts.
for (const language of ["deu", "eng"]) {
  const file = `${language}.traineddata.gz`;
  cpSync(join(modules, "@tesseract.js-data", language, "4.0.0_best_int", file), join(target, "lang", file));
}
