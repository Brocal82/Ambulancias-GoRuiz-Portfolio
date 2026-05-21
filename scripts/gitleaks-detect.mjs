import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = path.join(root, ".gitleaks.toml");

const result = spawnSync(
  "gitleaks",
  ["detect", "--no-banner", "--redact", "--config", config, "--source", root],
  { encoding: "utf8", shell: process.platform === "win32" },
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

if (
  result.error?.code === "ENOENT" ||
  /not recognized|command not found|ENOENT/i.test(output)
) {
  console.warn(
    "[secrets:scan] gitleaks not found — skipping (install: https://github.com/gitleaks/gitleaks#installing)",
  );
  process.exit(0);
}

if (output.trim()) {
  process.stdout.write(output);
}

process.exit(result.status ?? 1);
