import mongoose, { Document, Schema, Types } from "mongoose";

export type MechanicsWorkOrderStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface IMechanicsWorkOrder extends Document {
  companyId: Types.ObjectId;
  ambulanceId: Types.ObjectId;
  ambulanceNumber: string;
  title: string;
  description?: string;
  status: MechanicsWorkOrderStatus;
  plannedFor?: Date | null;
  assignedTo?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  completedAt?: Date | null;
  completedBy?: Types.ObjectId | null;
  completionNotes?: string;
  cancelledAt?: Date | null;
}

const mechanicsWorkOrderSchema = new Schema<IMechanicsWorkOrder>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    ambulanceId: {
      type: Schema.Types.ObjectId,
      ref: "Ambulance",
      required: true,
      index: true,
    },
    ambulanceNumber: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
      required: true,
      index: true,
    },
    plannedFor: { type: Date, default: null },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    completedAt: { type: Date, default: null },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    completionNotes: { type: String, trim: true, maxlength: 4000 },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

mechanicsWorkOrderSchema.index({ companyId: 1, ambulanceId: 1, status: 1 });

const MechanicsWorkOrder =
  (mongoose.models.MechanicsWorkOrder as mongoose.Model<IMechanicsWorkOrder>) ||
  mongoose.model<IMechanicsWorkOrder>(
    "MechanicsWorkOrder",
    mechanicsWorkOrderSchema,
  );

export default MechanicsWorkOrder;
