import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = path.join(root, "ambulancias-goruiz-backend");
const port = process.env.PORT || "5055";
const baseUrl = `http://127.0.0.1:${port}`;

function fail(message) {
  console.error(`[ci-smoke-backend] ${message}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(maxAttempts = 40) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        const body = await response.json();
        if (body?.status === "ok") {
          return body;
        }
      }
    } catch {
      // server still starting
    }
    await sleep(500);
  }
  fail(`Timed out waiting for ${baseUrl}/health`);
}

async function assertDocsJson() {
  const response = await fetch(`${baseUrl}/api/docs.json`);
  if (!response.ok) {
    fail(`/api/docs.json returned ${response.status}`);
  }

  const body = await response.json();
  if (!body?.openapi || !body?.paths?.["/health"]) {
    fail("/api/docs.json is missing expected OpenAPI fields");
  }
}

const server = spawn(process.execPath, ["dist/index.js"], {
  cwd: backendRoot,
  env: {
    ...process.env,
    PORT: port,
    NODE_ENV: "production",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout?.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr?.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

const shutdown = () => {
  if (!server.killed) {
    server.kill("SIGTERM");
  }
};

process.on("exit", shutdown);
process.on("SIGINT", () => {
  shutdown();
  process.exit(1);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(1);
});

server.on("exit", (code, signal) => {
  if (code !== 0 && code !== null && signal !== "SIGTERM") {
    fail(`Backend exited early with code ${code}\n${serverOutput}`);
  }
});

try {
  const health = await waitForHealth();
  console.log(`[ci-smoke-backend] /health OK: ${JSON.stringify(health)}`);
  await assertDocsJson();
  console.log("[ci-smoke-backend] /api/docs.json OK");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  shutdown();
}
