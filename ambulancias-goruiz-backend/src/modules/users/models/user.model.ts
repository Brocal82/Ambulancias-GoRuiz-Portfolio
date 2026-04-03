import mongoose, { Document, Schema, Types } from "mongoose";

export interface IUser extends Document {
  name: string;
  lastName: string;
  email: string;
  password: string;
  role: "admin" | "worker" | "superadmin";
  ambulanceRole?: "driver" | "medic" | "both";
  address?: string;
  phone?: string;
  emergencyPhone?: string;
  pscheinExpiry?: string; // Formato ISO, ej: '2025-12-31'
  /** Admin-confirmed P-Schein (minimal workflow; optional until Phase 2+) */
  pscheinConfirmedAt?: Date;
  pscheinConfirmedBy?: Types.ObjectId;
  /** Único PDF del P-Schein en perfil, ej. /uploads/... */
  pscheinDocument?: string;
  profileImage?: string; // URL o base64 si usas subida
  rotationMode?: "rotating" | "fixed" | "none";
  fixedDienstNumber?: number | null;
  companyId?: Types.ObjectId;
  employeeNumber?: string;
  invitationId?: Types.ObjectId;
  /**
   * Whether this user is currently active (employed / enabled).
   * Defaults to true for all new users.
   * Deactivated users (isActive: false) cannot log in and are excluded from
   * payroll coverage checks and auto-matching once Phase 7b is deployed.
   *
   * MIGRATION REQUIRED: run scripts/backfill-isActive.ts before deploying any
   * code that filters on `isActive: true` outside of the login path.
   */
  isActive: boolean;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "worker", "superadmin"],
    default: "worker",
    required: true,
  },
  ambulanceRole: {
    type: String,
    enum: ["driver", "medic", "both"],
    required: false,
  },
  address: {
    type: String,
    required: false,
  },
  phone: {
    type: String,
    required: false,
  },
  emergencyPhone: {
    type: String,
    required: false,
  },
  pscheinExpiry: {
    type: String,
    required: false,
  },
  pscheinConfirmedAt: {
    type: Date,
    required: false,
  },
  pscheinConfirmedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  pscheinDocument: {
    type: String,
    required: false,
    trim: true,
  },
  profileImage: {
    type: String,
    required: false,
  },
  rotationMode: {
    type: String,
    enum: ["rotating", "fixed", "none"],
    default: "none",
  },
  fixedDienstNumber: {
    type: Number,
    required: false,
    default: null,
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: "Company",
    required: false,
  },
  employeeNumber: {
    type: String,
    required: false,
    trim: true,
  },
  invitationId: {
    type: Schema.Types.ObjectId,
    ref: "Invitation",
    required: false,
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true,
    index: true,
  },
});

const User = mongoose.model<IUser>("User", userSchema);
export default User;
