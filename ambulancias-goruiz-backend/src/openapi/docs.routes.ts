import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";

const router = Router();

const specPath = path.join(__dirname, "openapi.json");

function loadSpec(): Record<string, unknown> {
  const raw = fs.readFileSync(specPath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

router.get("/docs.json", (_req: Request, res: Response) => {
  res.status(200).json(loadSpec());
});

router.get("/docs", (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ambulancias GoRuiz API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function () {
      SwaggerUIBundle({
        url: "/api/docs.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    };
  </script>
</body>
</html>`;
  res.status(200).type("html").send(html);
});

export { router as openApiRoutes };
