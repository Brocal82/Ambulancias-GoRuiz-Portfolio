import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Relative paths + cwd: on Windows the command runs through a shell, where an
// absolute path containing spaces would be split into several arguments.
const result = spawnSync(
  "gitleaks",
  ["detect", "--no-banner", "--redact", "--config", ".gitleaks.toml", "--source", "."],
  { encoding: "utf8", shell: process.platform === "win32", cwd: root },
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
