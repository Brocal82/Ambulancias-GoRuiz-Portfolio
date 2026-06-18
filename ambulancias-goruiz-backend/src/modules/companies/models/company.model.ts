import mongoose, { Document, Schema, Types } from "mongoose";
import type { PraemienRuleConfig } from "../../praemien/types/praemien-rule-config";

export interface ICompany extends Document {
  name: string;
  isActive: boolean;
  emailDomain: string;
  createdBy?: Types.ObjectId;
  /** Set by superadmin soft-delete; company hidden from listings and treated as removed. */
  deletedAt?: Date | null;
  /**
   * Canonical module keys enabled for this company.
   * An empty array means no modules are explicitly enabled.
   * Run scripts/backfill-company-modules.ts before activating
   * any requireModule() guard on a route.
   */
  enabledModules: string[];
  /**
   * Prämien calculation mode when the `praemien` module is enabled.
   * Phase 1: stored only; automatic math unchanged until later phases.
   */
  praemienMode?: "automatic" | "manual";
  /**
   * First calendar month (1–12) when `praemienMode` applies after a scheduled change.
   * Null/absent = no pending transition (current mode applies).
   */
  praemienModeEffectiveFrom?: { year: number; month: number } | null;
  /**
   * Company-scoped, constrained Prämien rules for new Workday closures.
   * Missing value preserves legacy defaults.
   */
  praemienRules?: PraemienRuleConfig | null;
  createdAt: Date;
  updatedAt: Date;
}

const praemienModeEffectiveFromSchema = new Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
  },
  { _id: false },
);

const praemienRuleSchema = new Schema(
  {
    id: { type: String, required: false, trim: true },
    label: { type: String, required: false, trim: true },
    enabled: { type: Boolean, required: true, default: true },
    type: {
      type: String,
      enum: [
        "km",
        "weekday",
        "dienstStartTime",
        "weekdayDienstStartTime",
        "weekdayPickupTime",
      ],
      required: true,
    },
    multiplier: { type: Number, required: true, min: 0, max: 10 },
    effectiveFrom: { type: String, required: false, default: null },
    effectiveTo: { type: String, required: false, default: null },
    minKm: { type: Number, required: false, min: 0, max: 10000 },
    maxKm: { type: Number, required: false, min: 0, max: 10000, default: null },
    weekdays: { type: [Number], required: false, default: undefined },
    startTimeFrom: { type: String, required: false },
    startTimeTo: { type: String, required: false },
    pickupTimeFrom: { type: String, required: false },
    pickupTimeTo: { type: String, required: false },
  },
  { _id: false },
);

const praemienRuleConfigSchema = new Schema(
  {
    version: { type: Number, required: true, enum: [1], default: 1 },
    rules: {
      type: [praemienRuleSchema],
      required: true,
    },
    cancelledTripPolicy: {
      type: String,
      enum: ["excludeUnlessCountsTrip"],
      required: true,
      default: "excludeUnlessCountsTrip",
    },
  },
  { _id: false },
);

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    enabledModules: { type: [String], default: [] },
    praemienMode: {
      type: String,
      enum: ["automatic", "manual"],
      default: "automatic",
    },
    praemienModeEffectiveFrom: {
      type: praemienModeEffectiveFromSchema,
      default: null,
    },
    praemienRules: {
      type: praemienRuleConfigSchema,
      default: null,
    },
    emailDomain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator(v: string | undefined | null) {
          return typeof v === "string" && v.length > 0 && v.startsWith("@");
        },
        message: "emailDomain debe empezar por @",
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

const Company = mongoose.model<ICompany>("Company", companySchema);
export default Company;
