import { Schema, model, Document, Types } from "mongoose";

export interface INotificationLog extends Document {
  userId: Types.ObjectId;
  title: string;
  body: string;
  data: Record<string, unknown>;
  createdAt: Date;
}

const notificationLogSchema = new Schema<INotificationLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationLogSchema.index({ userId: 1, createdAt: -1 });

export const NotificationLog = model<INotificationLog>(
  "NotificationLog",
  notificationLogSchema,
);
