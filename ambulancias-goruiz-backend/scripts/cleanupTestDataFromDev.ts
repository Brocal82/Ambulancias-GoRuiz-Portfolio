/**
 * Limpieza segura de datos de test que contaminaron la DB de desarrollo.
 * Usa MONGODB_URI de .env (desarrollo). NO usa MONGODB_URI_TEST.
 *
 * Modos:
 *   --dry-run (por defecto): solo lista y cuenta, no borra nada
 *   --execute: borra tras confirmación explícita (escribir YES)
 *
 * Usa colecciones nativas de MongoDB para evitar compilar todo el backend.
 */
import mongoose from "mongoose";
import * as readline from "readline";
import dotenv from "dotenv";

dotenv.config();

const TEST_EMAIL_REGEX = /^(admin-test|worker-test)-\d+@example\.com$/;

const isExecute = process.argv.includes("--execute");

async function main() {
  const MONGO_URI = process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error("❌ MONGODB_URI no definido en .env");
    process.exit(1);
  }

  // Asegurar que usamos DB de desarrollo (no test)
  if (MONGO_URI.includes("ambulancias_test") || MONGO_URI.includes("_test")) {
    console.error("❌ Error: MONGODB_URI parece apuntar a DB de test.");
    console.error("   Este script debe usar la DB de desarrollo (.env).");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    if (!db) throw new Error("No DB connection");

    console.log("📡 Conectado a MongoDB (DB de desarrollo)\n");

    const usersCol = db.collection("users");
    const teamsCol = db.collection("teams");
    const dienstsCol = db.collection("diensts");

    // 1. Detectar usuarios de test
    const testUsers = await usersCol
      .find({ email: { $regex: TEST_EMAIL_REGEX } })
      .project({ _id: 1, email: 1, name: 1, lastName: 1 })
      .toArray();

    const testUserIds = testUsers.map((u) => u._id);

    // 2. Detectar teams con driver o medic en usuarios de test
    const testTeams = await teamsCol
      .find({
        $or: [
          { driver: { $in: testUserIds } },
          { medic: { $in: testUserIds } },
        ],
      })
      .toArray();

    // Resolver emails para el reporte
    const userIdToEmail = new Map(
      testUsers.map((u) => [u._id.toString(), u.email as string]),
    );

    // 3. Detectar diensts con weekStartDate en 2030 o 2040
    const diensts2030 = await dienstsCol
      .find({
        weekStartDate: {
          $gte: new Date("2030-01-01"),
          $lt: new Date("2031-01-01"),
        },
      })
      .project({ _id: 1, dienstNumber: 1, weekStartDate: 1 })
      .toArray();

    const diensts2040 = await dienstsCol
      .find({
        weekStartDate: {
          $gte: new Date("2040-01-01"),
          $lt: new Date("2041-01-01"),
        },
      })
      .project({ _id: 1, dienstNumber: 1, weekStartDate: 1 })
      .toArray();

    const testDiensts = [...diensts2030, ...diensts2040];

    // --- Reporte ---
    console.log("═══════════════════════════════════════════════════");
    console.log("  REPORTE DETECCIÓN DE DATOS DE TEST");
    console.log("═══════════════════════════════════════════════════\n");

    console.log("📋 USUARIOS (email admin-test-* o worker-test-*@example.com):");
    console.log(`   Total: ${testUsers.length}`);
    if (testUsers.length > 0) {
      testUsers.forEach((u) => {
        const uu = u as { email: string; name?: string; lastName?: string };
        console.log(`   - ${uu.email} (${uu.name ?? ""} ${uu.lastName ?? ""})`);
      });
    }
    console.log("");

    console.log("📋 TEAMS (driver o medic son usuarios de test):");
    console.log(`   Total: ${testTeams.length}`);
    if (testTeams.length > 0) {
      testTeams.forEach((t) => {
        const tt = t as { _id: unknown; driver?: unknown; medic?: unknown };
        const drvId = tt.driver?.toString?.() ?? "";
        const medId = tt.medic?.toString?.() ?? "";
        console.log(
          `   - ${tt._id} | driver: ${userIdToEmail.get(drvId) ?? "n/a"} | medic: ${userIdToEmail.get(medId) ?? "n/a"}`,
        );
      });
    }
    console.log("");

    console.log("📋 DIENSTS (weekStartDate en 2030 o 2040):");
    console.log(`   Total: ${testDiensts.length}`);
    if (testDiensts.length > 0) {
      testDiensts.slice(0, 10).forEach((d) => {
        const dd = d as { _id: unknown; dienstNumber?: number; weekStartDate?: Date };
        console.log(`   - ${dd._id} | Dienst #${dd.dienstNumber} | ${dd.weekStartDate}`);
      });
      if (testDiensts.length > 10) {
        console.log(`   ... y ${testDiensts.length - 10} más`);
      }
    }
    console.log("");

    const totalToDelete =
      testUsers.length + testTeams.length + testDiensts.length;

    if (totalToDelete === 0) {
      console.log("✅ No se detectaron datos de test. Nada que borrar.\n");
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    console.log("═══════════════════════════════════════════════════");
    console.log(`  RESUMEN: ${totalToDelete} documentos a borrar`);
    console.log(`  - diensts: ${testDiensts.length}`);
    console.log(`  - teams: ${testTeams.length}`);
    console.log(`  - users: ${testUsers.length}`);
    console.log("═══════════════════════════════════════════════════\n");

    if (!isExecute) {
      console.log("🔒 Modo: DRY-RUN (no se borró nada)");
      console.log("   Para ejecutar borrado real: npm run cleanup:test-data -- --execute\n");
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    // --- Modo execute: pedir confirmación ---
    console.log("⚠️  MODO EXECUTE: borrado real tras confirmación.\n");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Escribe "YES" (en mayúsculas) para confirmar el borrado: ', resolve);
    });
    rl.close();

    if (answer.trim() !== "YES") {
      console.log("\n❌ Confirmación cancelada. No se borró nada.\n");
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    console.log("\n🗑️  Ejecutando borrado...\n");

    // Orden: diensts, teams, users
    const dienstIds = testDiensts.map((d) => (d as { _id: mongoose.Types.ObjectId })._id);
    const teamIds = testTeams.map((t) => (t as { _id: mongoose.Types.ObjectId })._id);

    const deleteResultDiensts = await dienstsCol.deleteMany({
      _id: { $in: dienstIds },
    });
    console.log(`   diensts borrados: ${deleteResultDiensts.deletedCount}`);

    const deleteResultTeams = await teamsCol.deleteMany({
      _id: { $in: teamIds },
    });
    console.log(`   teams borrados: ${deleteResultTeams.deletedCount}`);

    const deleteResultUsers = await usersCol.deleteMany({
      _id: { $in: testUserIds as mongoose.Types.ObjectId[] },
    });
    console.log(`   users borrados: ${deleteResultUsers.deletedCount}`);

    console.log("\n✅ Limpieza completada.\n");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
