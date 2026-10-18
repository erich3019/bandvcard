// Copies the design guide's CSS from the repository's guidelines/ folder into src/styles/guidelines,
// because Turbopack does not load CSS from outside the frontend. Runs before `dev` and `build`;
// in the Docker build, compose passes guidelines/ as an additional build context.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "..", "guidelines", "css");
const target = join(root, "src", "styles", "guidelines");

// The profile must match the import in src/app/globals.css.
const files = ["tokens.css", "tailwind-theme.css", join("profiles", "standard.css")];

if (!existsSync(source)) {
  throw new Error(`Design guide not found at ${source}`);
}
mkdirSync(join(target, "profiles"), { recursive: true });
for (const file of files) {
  cpSync(join(source, file), join(target, file));
}
