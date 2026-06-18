import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { createTestAdminWithCompany } from "./test-helpers";
import Company from "../modules/companies/models/company.model";

const API = "/api";

describe("Praemien rules tenant configuration", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("admin manages only own company Prämien rules", async () => {
    const own = await createTestAdminWithCompany();
    const other = await createTestAdminWithCompany();

    const customRules = {
      version: 1,
      rules: [
        {
          type: "km",
          enabled: true,
          minKm: 30,
          maxKm: null,
          multiplier: 3,
        },
        {
          type: "weekdayDienstStartTime",
          enabled: true,
          weekdays: [1],
          startTimeFrom: "12:00",
          startTimeTo: "14:00",
          multiplier: 1.5,
        },
      ],
      cancelledTripPolicy: "excludeUnlessCountsTrip",
    };

    try {
      const defaults = await request(app)
        .get(`${API}/praemien/rules`)
        .set("Authorization", `Bearer ${own.adminToken}`)
        .expect(200);
      expect(defaults.body.rules[0].type).toBe("km");

      const saved = await request(app)
        .patch(`${API}/praemien/rules`)
        .set("Authorization", `Bearer ${own.adminToken}`)
        .send(customRules)
        .expect(200);
      expect(saved.body.rules[0].minKm).toBe(30);
      expect(saved.body.rules[1].type).toBe("weekdayDienstStartTime");

      const ownCompany = await Company.findById(own.companyId).lean();
      const otherCompany = await Company.findById(other.companyId).lean();
      expect(ownCompany?.praemienRules?.rules?.[0]?.type).toBe("km");
      expect(otherCompany?.praemienRules ?? null).toBeNull();
    } finally {
      await Company.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(own.companyId),
            new mongoose.Types.ObjectId(other.companyId),
          ],
        },
      });
    }
  });

  it("rejects invalid rule payloads", async () => {
    const own = await createTestAdminWithCompany();
    try {
      const res = await request(app)
        .patch(`${API}/praemien/rules`)
        .set("Authorization", `Bearer ${own.adminToken}`)
        .send({
          version: 1,
          rules: [
            {
              type: "weekdayDienstStartTime",
              enabled: true,
              weekdays: [1],
              startTimeFrom: "20:00",
              startTimeTo: "12:00",
              multiplier: 1.5,
            },
          ],
          cancelledTripPolicy: "excludeUnlessCountsTrip",
        })
        .expect(400);
      expect(String(res.body.message)).toMatch(/inválidos|invalid/i);
    } finally {
      await Company.deleteOne({ _id: new mongoose.Types.ObjectId(own.companyId) });
    }
  });
});
