/**
 * Setup de Jest: carga .env.test OBLIGATORIAMENTE.
 * Evita ejecutar tests contra DB de desarrollo/producción por accidente.
 */
const path = require("path");
const fs = require("fs");

const envPath = path.resolve(process.cwd(), ".env.test");

if (!fs.existsSync(envPath)) {
  console.error("");
  console.error("❌ ERROR: No existe .env.test");
  console.error("");
  console.error("Los tests requieren un entorno de pruebas explícito.");
  console.error("Copia .env.test.example a .env.test y configura MONGODB_URI y JWT_SECRET.");
  console.error("");
  console.error("  macOS/Linux:  cp .env.test.example .env.test");
  console.error("  PowerShell:   Copy-Item .env.test.example .env.test");
  console.error("");
  process.exit(1);
}

require("dotenv").config({ path: envPath });
