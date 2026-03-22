import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  subject: string;
  body: string;
  sender: mongoose.Types.ObjectId;
  recipients: mongoose.Types.ObjectId[];
  sentAt: Date;
  readBy: mongoose.Types.ObjectId[];
  removedBy: mongoose.Types.ObjectId[];
  toAllWorkers?: boolean;
  attachments?: {
    originalName: string;
    filename: string;
    mimetype: string;
    size: number;
    url: string;
  }[];
}

const attachmentSchema = new Schema(
  {
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessage>({
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  body: {
    type: String,
    required: true,
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  recipients: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  ],
  sentAt: {
    type: Date,
    default: Date.now,
  },
  readBy: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  removedBy: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },
  ],
  toAllWorkers: {
    type: Boolean,
    default: false,
  },
  attachments: {
    type: [attachmentSchema],
    default: [],
  },
});

messageSchema.index({ recipients: 1, sentAt: -1 });
messageSchema.index({ readBy: 1 });
messageSchema.index({ removedBy: 1 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);
