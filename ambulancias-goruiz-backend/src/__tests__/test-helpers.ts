/**
 * Helpers para tests de integración.
 * El registro público SIEMPRE crea workers. Los admins se crean vía seed/script (DB directa).
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

export async function createTestUsers() {
  const suffix = Date.now();
  const adminEmail = `admin-test-${suffix}@example.com`;
  const workerEmail = `worker-test-${suffix}@example.com`;
  const password = "password123";

  const adminUser = await createTestAdminUser(adminEmail, password);

  await request(app).post(`${API}/users/register`).send({
    name: "Worker",
    lastName: "Test",
    email: workerEmail,
    password,
  });

  const adminRes = await request(app)
    .post(`${API}/users/login`)
    .send({ email: adminEmail, password });
  const workerRes = await request(app)
    .post(`${API}/users/login`)
    .send({ email: workerEmail, password });

  return {
    adminId: String(adminUser._id),
    workerId: workerRes.body.user?._id ?? "",
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
  });
  return worker;
}
