import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IUserSessionState extends Document {
  userId: Types.ObjectId;
  tokenVersion: number;
  updatedAt: Date;
}

const userSessionStateSchema = new Schema<IUserSessionState>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    tokenVersion: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

const UserSessionState = mongoose.model<IUserSessionState>(
  "UserSessionState",
  userSessionStateSchema,
);

export default UserSessionState;
