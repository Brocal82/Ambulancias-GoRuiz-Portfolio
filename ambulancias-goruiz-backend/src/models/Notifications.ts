import mongoose, { Schema, Document, Types } from "mongoose";

export type NotificationRole = "admin" | "worker";
export type NotificationType =
  | "info"
  | "warning"
  | "critical"
  | "message"
  | "report"
  | "summary";

export interface INotification extends Document {
  title: string;
  message: string;
  recipientId?: Types.ObjectId; // si se dirige a un usuario concreto
  role?: NotificationRole; // si se dirige a un rol (admin/worker)
  isRead: boolean;
  type: NotificationType;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    role: { type: String, enum: ["admin", "worker"], index: true },
    isRead: { type: Boolean, default: false, index: true },
    type: {
      type: String,
      enum: ["info", "warning", "critical", "message", "report", "summary"],
      default: "info",
      index: true,
    },
  },
  { timestamps: true },
);

// Índices útiles para listados/contadores
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ recipientId: 1, isRead: 1, type: 1 });
NotificationSchema.index({ role: 1, isRead: 1, type: 1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema,
);
