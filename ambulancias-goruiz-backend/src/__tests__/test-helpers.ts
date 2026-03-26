/**
 * Helpers para tests de integración.
 * Register público desactivado (8B). Workers/admins se crean por DB o invitación.
 */
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import request from "supertest";
import { app } from "../app";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";

const API = "/api";

export async function createTestAdminUser(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: "Admin",
    lastName: "Test",
    email,
    password: hashedPassword,
    role: "admin",
  });
  return user;
}

/** Crea superadmin directamente en DB. Útil para tests de rutas exclusivas superadmin. */
export async function createTestSuperadmin(email?: string, password = "password123") {
  const suffix = Date.now() + Math.floor(Math.random() * 1000);
  const superadminEmail = email ?? `superadmin-${suffix}@example.com`;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: "Super",
    lastName: "Admin",
    email: superadminEmail,
    password: hashedPassword,
    role: "superadmin",
  });
  const loginRes = await request(app)
    .post(`${API}/users/login`)
    .send({ email: superadminEmail, password });
  return {
    superadminId: String(user._id),
    superadminToken: loginRes.body.token,
    email: superadminEmail,
  };
}

/**
 * Crea un worker en DB sin company (legacy). No usa register.
 */
export async function createTestWorkerUser(email?: string, password = "password123") {
  const suffix = Date.now();
  const workerEmail = email ?? `worker-test-${suffix}@example.com`;
  const hashedPassword = await bcrypt.hash(password, 10);
  return await User.create({
    name: "Worker",
    lastName: "Test",
    email: workerEmail,
    password: hashedPassword,
    role: "worker",
  });
}

export async function createTestUsers() {
  const suffix = Date.now();
  const adminEmail = `admin-test-${suffix}@example.com`;
  const password = "password123";

  const adminUser = await createTestAdminUser(adminEmail, password);
  const workerUser = await createTestWorkerUser(`worker-test-${suffix}@example.com`, password);

  const adminRes = await request(app)
    .post(`${API}/users/login`)
    .send({ email: adminEmail, password });
  const workerRes = await request(app)
    .post(`${API}/users/login`)
    .send({ email: workerUser.email, password });

  return {
    adminId: String(adminUser._id),
    workerId: String(workerUser._id),
    adminToken: adminRes.body.token,
    workerToken: workerRes.body.token,
  };
}

export async function createTestAdminWithCompany(password: string = "password123") {
  const suffix = Date.now() + Math.floor(Math.random() * 1000);
  const adminEmail = `admin-company-${suffix}@example.com`;

  const company = await Company.create({ name: `Test Company ${suffix}`, isActive: true });
  const hashedPassword = await bcrypt.hash(password, 10);
  const adminUser = await User.create({
    name: "Admin",
    lastName: "Company",
    email: adminEmail,
    password: hashedPassword,
    role: "admin",
    companyId: company._id,
    ambulanceRole: "both",
  });

  const loginRes = await request(app)
    .post(`${API}/users/login`)
    .send({ email: adminEmail, password });

  return {
    adminId: String(adminUser._id),
    companyId: String(company._id),
    adminToken: loginRes.body.token,
    company,
  };
}

/**
 * Crea un worker directamente en la DB asociado a una empresa.
 * Útil para tests de aislamiento sin pasar por el flujo de invitaciones.
 */
export async function createTestWorkerInCompany(
  companyId: mongoose.Types.ObjectId,
  suffix?: number,
) {
  const s = suffix ?? Date.now();
  const email = `worker-company-${s}@example.com`;
  const hashedPassword = await bcrypt.hash("password123", 10);
  const worker = await User.create({
    name: "Worker",
    lastName: "Company",
    email,
    password: hashedPassword,
    role: "worker",
    companyId,
    ambulanceRole: "both",
  });
  return worker;
}
