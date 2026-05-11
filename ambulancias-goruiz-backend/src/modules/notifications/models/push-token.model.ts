import { Schema, model, Document, Types } from "mongoose";

export interface IPushToken extends Document {
  userId: Types.ObjectId;
  token: string;
  platform: "ios" | "android";
  createdAt: Date;
}

const pushTokenSchema = new Schema<IPushToken>(
  {
    // userId is NOT unique alone — one user can have multiple devices.
    // MIGRATION REQUIRED (run once in MongoDB shell):
    //   db.pushtokens.dropIndex("userId_1")
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true },
    platform: { type: String, enum: ["ios", "android"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One token string can only belong to one (userId, token) pair.
pushTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

export const PushToken = model<IPushToken>("PushToken", pushTokenSchema);
