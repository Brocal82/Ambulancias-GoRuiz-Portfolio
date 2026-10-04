/**
 * One-shot bootstrap: crea el primer superadmin
 * (solo entornos vacíos / de desarrollo; cambia la contraseña tras el primer login).
 *
 * Uso (desde la carpeta ambulancias-goruiz-backend):
 *   SUPERADMIN_PASSWORD=<min-8-chars> npm run create:superadmin
 *   SUPERADMIN_EMAIL=admin@example.com SUPERADMIN_PASSWORD=<min-8-chars> npx ts-node scripts/createSuperAdmin.ts
 *
 * - Usa MONGODB_URI y JWT_SECRET desde .env (misma carga que src/config/env.ts).
 * - La contraseña se lee de SUPERADMIN_PASSWORD (obligatoria, nunca en código).
 * - Si ya existe un usuario con role "superadmin", no hace nada.
 * - Contraseña: bcrypt 10 (igual que users.service y bootstrap-superadmin).
 */
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { env } from "../src/config/env";
import User from "../src/modules/users/models/user.model";

const BCRYPT_ROUNDS = 10;
const EMAIL = process.env.SUPERADMIN_EMAIL || "superadmin@goruiz.com";
const PLAIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;

async function run(): Promise<void> {
  const normalizedEmail = EMAIL.trim().toLowerCase();

  if (!PLAIN_PASSWORD || PLAIN_PASSWORD.length < 8) {
    console.error(
      "Define SUPERADMIN_PASSWORD (mínimo 8 caracteres). Ejemplo: SUPERADMIN_PASSWORD=<secreto> npm run create:superadmin",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(env.MONGODB_URI);
  } catch (err) {
    console.error("Error conectando a MongoDB:", err);
    process.exit(1);
  }

  const existingSuperadmin = await User.findOne({ role: "superadmin" });
  if (existingSuperadmin) {
    console.log(
      "ℹ️  Ya existe un usuario con role superadmin. No se crea otro. Salida segura.",
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  const emailTaken = await User.findOne({ email: normalizedEmail });
  if (emailTaken) {
    console.error(
      `El email ${normalizedEmail} ya está en uso (sin ser superadmin). Resuélvelo manualmente o usa otro email.`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(PLAIN_PASSWORD, BCRYPT_ROUNDS);

  await User.create({
    name: "Super",
    lastName: "Admin",
    email: normalizedEmail,
    password: hashedPassword,
    role: "superadmin",
    isActive: true,
  });

  console.log(
    `Superadmin creado: ${normalizedEmail} (cambia la contraseña en producción).`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
