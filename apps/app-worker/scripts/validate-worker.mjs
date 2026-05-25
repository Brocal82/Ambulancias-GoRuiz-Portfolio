import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["tsc", "-p", "tsconfig.json", "--noEmit"]);
run("npx", ["tsc", "-p", "tsconfig.validate.json"]);

const buildDir = path.join(root, ".validate-build");
const testFile = path.join(buildDir, "scripts", "validate-worker.test.js");
if (!fs.existsSync(testFile)) {
  console.error("[validate-worker] Compiled test file not found:", testFile);
  process.exit(1);
}

run(process.execPath, ["--test", testFile], { shell: false });
