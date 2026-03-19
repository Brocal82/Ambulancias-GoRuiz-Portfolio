// Cargar .env.test antes de que se importe cualquier módulo que use env
// Si no existe .env.test, dotenv no hace nada (process.env ya puede tener vars)
const path = require("path");
const fs = require("fs");
const envPath = path.resolve(process.cwd(), ".env.test");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  require("dotenv").config(); // fallback a .env
}
