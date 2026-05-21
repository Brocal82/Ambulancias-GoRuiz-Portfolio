import { Router, Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import fs from "fs";
import path from "path";

const router = Router();

const specPath = path.join(__dirname, "openapi.json");

/** CSP scoped to Swagger UI only — does not change global Helmet config. */
const SWAGGER_DOCS_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' https: data:",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "img-src 'self' data: https:",
  "object-src 'none'",
  "script-src 'self' https://unpkg.com",
  "script-src-attr 'none'",
  "style-src 'self' https: 'unsafe-inline'",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

function setSwaggerDocsCsp(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Content-Security-Policy", SWAGGER_DOCS_CSP);
  next();
}

/**
 * Public read-only docs rate limit (separate from global /api limit).
 * Mounted before rateLimitGlobal in app.ts; login and other /api routes unchanged.
 */
const rateLimitDocs = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  message: { message: "Demasiadas solicitudes a la documentación. Intente más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

function loadSpec(): Record<string, unknown> {
  const raw = fs.readFileSync(specPath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

const SWAGGER_INIT_JS = `window.addEventListener("load", function () {
  SwaggerUIBundle({
    url: "/api/docs.json",
    dom_id: "#swagger-ui",
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis],
  });
});`;

router.get("/docs.json", rateLimitDocs, (_req: Request, res: Response) => {
  res.status(200).json(loadSpec());
});

router.get("/docs/init.js", rateLimitDocs, setSwaggerDocsCsp, (_req: Request, res: Response) => {
  res.status(200).type("application/javascript").send(SWAGGER_INIT_JS);
});

router.get("/docs", rateLimitDocs, setSwaggerDocsCsp, (_req: Request, res: Response) => {
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
  <script src="/api/docs/init.js"></script>
</body>
</html>`;
  res.status(200).type("html").send(html);
});

export { router as openApiRoutes };
