/**
 * Bootstrap del primer superadmin.
 * Uso: EMAIL=x@example.com PASSWORD=secret npx ts-node scripts/bootstrap-superadmin.ts
 * o: npx ts-node scripts/bootstrap-superadmin.ts x@example.com secret
 *
 * - Rechaza si el email ya existe.
 * - No es un endpoint público; ejecutar manualmente en entorno controlado.
 */
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../src/modules/users/models/user.model";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ambulance_db";

async function bootstrap() {
  const email =
    process.env.EMAIL || process.argv[2];
  const password =
    process.env.PASSWORD || process.argv[3];

  if (!email || !password) {
    console.error("Uso: EMAIL=x@example.com PASSWORD=secret npx ts-node scripts/bootstrap-superadmin.ts");
    console.error("  o: npx ts-node scripts/bootstrap-superadmin.ts email@example.com password");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("La contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
  } catch (err) {
    console.error("Error conectando a MongoDB:", err);
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    console.error(`El email ${normalizedEmail} ya existe en el sistema.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({
    name: "Super",
    lastName: "Admin",
    email: normalizedEmail,
    password: hashedPassword,
    role: "superadmin",
  });

  console.log(`Superadmin creado: ${normalizedEmail}`);
  await mongoose.disconnect();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
