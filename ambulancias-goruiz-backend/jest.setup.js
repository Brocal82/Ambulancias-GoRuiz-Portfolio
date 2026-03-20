/**
 * Setup de Jest: carga .env.test OBLIGATORIAMENTE.
 * Evita ejecutar tests contra DB de desarrollo/producción por accidente.
 *
 * IMPORTANTE: Usa MONGODB_URI_TEST (no MONGODB_URI) para aislar la DB de tests.
 */
const path = require("path");
const fs = require("fs");

// Jest ya suele poner NODE_ENV=test, pero lo forzamos por si acaso
process.env.NODE_ENV = "test";

const envPath = path.resolve(process.cwd(), ".env.test");

if (!fs.existsSync(envPath)) {
  console.error("");
  console.error("❌ ERROR: No existe .env.test");
  console.error("");
  console.error("Los tests requieren un entorno de pruebas explícito.");
  console.error("Copia .env.test.example a .env.test y configura:");
  console.error("  - MONGODB_URI_TEST: DB dedicada para tests (ej: mongodb://localhost/ambulancias_test)");
  console.error("  - JWT_SECRET: secret para tokens");
  console.error("");
  console.error("  macOS/Linux:  cp .env.test.example .env.test");
  console.error("  PowerShell:   Copy-Item .env.test.example .env.test");
  console.error("");
  process.exit(1);
}

require("dotenv").config({ path: envPath });
