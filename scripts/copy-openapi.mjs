import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "ambulancias-goruiz-backend");
const src = path.join(backendRoot, "src", "openapi", "openapi.json");
const destDir = path.join(backendRoot, "dist", "openapi");
const dest = path.join(destDir, "openapi.json");

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("[copy:openapi] copied to dist/openapi/openapi.json");
