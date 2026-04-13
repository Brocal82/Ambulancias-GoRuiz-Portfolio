import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import PayrollDocument from "../src/modules/payroll/models/payroll-document.model";

dotenv.config();

const MONGO_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ambulance_db";
const uploadsDir = path.resolve(__dirname, "../uploads");
const shouldDelete = process.argv.includes("--delete");
const SHARED_UPLOADS_SAFETY_LOCK = true;

const isValidFilename = (filename: string): boolean => {
  if (!filename || filename.trim().length === 0) return false;
  if (filename.includes("/") || filename.includes("\\")) return false;
  return path.basename(filename) === filename;
};

const getReferencedFilenames = async (): Promise<Set<string>> => {
  const docs = await PayrollDocument.find({}, { fileUrl: 1, _id: 0 }).lean();
  const referenced = new Set<string>();

  for (const doc of docs) {
    const fileUrl = typeof doc.fileUrl === "string" ? doc.fileUrl.trim() : "";
    if (!fileUrl.startsWith("/uploads/")) continue;

    const filename = fileUrl.slice("/uploads/".length);
    if (!isValidFilename(filename)) continue;

    referenced.add(filename);
  }

  return referenced;
};

const cleanupOrphanPayrollFiles = async () => {
  let connected = false;

  try {
    console.log("Starting orphan payroll files cleanup script...");
    console.log(`Mode: ${shouldDelete ? "DELETE" : "DRY RUN"}`);
    console.log(`Uploads directory: ${uploadsDir}`);

    if (!fs.existsSync(uploadsDir)) {
      console.error("Uploads directory does not exist.");
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    connected = true;
    console.log("MongoDB connected.");

    const diskEntries = fs.readdirSync(uploadsDir, { withFileTypes: true });
    const uploadFiles = diskEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);

    const invalidDiskFiles: string[] = [];
    const validDiskFiles: string[] = [];
    for (const file of uploadFiles) {
      if (!isValidFilename(file)) {
        invalidDiskFiles.push(file);
        continue;
      }
      validDiskFiles.push(file);
    }

    const referencedFiles = await getReferencedFilenames();
    const orphanFiles = validDiskFiles.filter((file) => !referencedFiles.has(file));

    console.log("---- Report ----");
    console.log(`Total files on disk: ${uploadFiles.length}`);
    console.log(`Valid filenames on disk: ${validDiskFiles.length}`);
    console.log(`Referenced files in PayrollDocument: ${referencedFiles.size}`);
    console.log(`Payroll-unreferenced files detected: ${orphanFiles.length}`);

    if (invalidDiskFiles.length > 0) {
      console.log(
        `Skipped invalid filenames (never deleted): ${invalidDiskFiles.length}`,
      );
      invalidDiskFiles.forEach((file) => console.log(` - INVALID: ${file}`));
    }

    if (orphanFiles.length > 0) {
      console.log("Payroll-unreferenced filenames:");
      orphanFiles.forEach((file) => console.log(` - ${file}`));
    }

    if (!shouldDelete) {
      console.log("Dry run completed. No files were deleted.");
      return;
    }

    if (SHARED_UPLOADS_SAFETY_LOCK) {
      console.log(
        "Safety lock active: /uploads is shared across modules and file ownership cannot be proven from PayrollDocument alone.",
      );
      console.log("Delete mode aborted to avoid deleting valid non-payroll files.");
      return;
    }

    console.log("Delete flag detected. Starting safe deletion...");
    let deletedCount = 0;

    for (const filename of orphanFiles) {
      if (!isValidFilename(filename)) {
        console.log(`SKIP invalid filename: ${filename}`);
        continue;
      }
      if (referencedFiles.has(filename)) {
        console.log(`SKIP referenced file: ${filename}`);
        continue;
      }

      const fullPath = path.resolve(uploadsDir, filename);
      if (!fullPath.startsWith(`${uploadsDir}${path.sep}`)) {
        console.log(`SKIP unsafe path: ${filename}`);
        continue;
      }
      if (!fs.existsSync(fullPath)) {
        console.log(`SKIP missing file: ${filename}`);
        continue;
      }

      const stat = fs.lstatSync(fullPath);
      if (!stat.isFile()) {
        console.log(`SKIP non-file entry: ${filename}`);
        continue;
      }

      fs.unlinkSync(fullPath);
      deletedCount += 1;
      console.log(`DELETED: ${filename}`);
    }

    console.log(`Deletion completed. Deleted files: ${deletedCount}`);
    console.log(`Orphan files detected at start: ${orphanFiles.length}`);
  } catch (error) {
    console.error("Error during orphan payroll files cleanup:", error);
    process.exitCode = 1;
  } finally {
    if (connected) {
      await mongoose.disconnect();
      console.log("MongoDB disconnected.");
    }
  }
};

cleanupOrphanPayrollFiles();
