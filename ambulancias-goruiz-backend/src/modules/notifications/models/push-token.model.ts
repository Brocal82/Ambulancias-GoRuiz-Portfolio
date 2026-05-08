import { Schema, model, Document, Types } from "mongoose";

export interface IPushToken extends Document {
  userId: Types.ObjectId;
  token: string;
  platform: "ios" | "android";
  createdAt: Date;
}

const pushTokenSchema = new Schema<IPushToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    token: { type: String, required: true },
    platform: { type: String, enum: ["ios", "android"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const PushToken = model<IPushToken>("PushToken", pushTokenSchema);
