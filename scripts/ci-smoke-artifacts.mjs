import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const checks = [
  {
    label: "frontend dist/index.html",
    path: path.join(root, "ambulancias-goruiz-frontend", "dist", "index.html"),
  },
  {
    label: "backend dist/openapi/openapi.json",
    path: path.join(root, "ambulancias-goruiz-backend", "dist", "openapi", "openapi.json"),
  },
  {
    label: "backend dist/index.js",
    path: path.join(root, "ambulancias-goruiz-backend", "dist", "index.js"),
  },
];

let failed = false;

for (const check of checks) {
  if (!fs.existsSync(check.path)) {
    console.error(`[ci-smoke-artifacts] Missing ${check.label}: ${check.path}`);
    failed = true;
    continue;
  }
  console.log(`[ci-smoke-artifacts] OK: ${check.label}`);
}

process.exit(failed ? 1 : 0);
