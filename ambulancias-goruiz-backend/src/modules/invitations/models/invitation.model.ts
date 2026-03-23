import mongoose, { Document, Schema, Types } from "mongoose";

export interface IInvitation extends Document {
  companyId: Types.ObjectId;
  email: string;
  role: "admin" | "worker";
  tokenHash: string;
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  invitedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IInvitation>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ["admin", "worker"],
      required: true,
    },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, required: false },
    revokedAt: { type: Date, required: false },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  },
  { timestamps: true },
);

const Invitation = mongoose.model<IInvitation>("Invitation", invitationSchema);
export default Invitation;
