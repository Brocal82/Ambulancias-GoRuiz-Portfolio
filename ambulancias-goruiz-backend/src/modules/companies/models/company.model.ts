import mongoose, { Document, Schema, Types } from "mongoose";

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
