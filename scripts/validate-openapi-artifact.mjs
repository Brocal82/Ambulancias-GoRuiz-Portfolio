import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const openapiPath = path.join(root, "ambulancias-goruiz-backend", "dist", "openapi", "openapi.json");

const requiredPaths = ["/health", "/api/users/login"];

function fail(message) {
  console.error(`[validate-openapi-artifact] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(openapiPath)) {
  fail(`Missing build artifact: ${openapiPath}`);
}

let spec;
try {
  spec = JSON.parse(fs.readFileSync(openapiPath, "utf8"));
} catch (error) {
  fail(`Invalid JSON in ${openapiPath}: ${error.message}`);
}

if (spec.openapi !== "3.0.3") {
  fail(`Unexpected openapi version: ${spec.openapi ?? "missing"}`);
}

if (!spec.info?.title || !spec.info?.version) {
  fail("OpenAPI info.title and info.version are required");
}

const paths = spec.paths ?? {};
for (const requiredPath of requiredPaths) {
  if (!paths[requiredPath]) {
    fail(`Missing required OpenAPI path: ${requiredPath}`);
  }
}

console.log(`[validate-openapi-artifact] OK: ${openapiPath}`);
