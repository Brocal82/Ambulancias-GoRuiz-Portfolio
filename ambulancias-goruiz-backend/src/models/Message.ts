// backend/src/models/Message.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  subject: string;
  body: string;
  sender: mongoose.Types.ObjectId;
  recipients: mongoose.Types.ObjectId[];
  sentAt: Date;
  readBy: mongoose.Types.ObjectId[];
  toAllWorkers?: boolean;
  // 👇 Nuevo (opcional): metadatos de adjuntos
  attachments?: {
    originalName: string;
    filename: string;
    mimetype: string;
    size: number;
    url: string;
  }[];
}

// 👇 Subesquema para adjuntos (sin _id)
const attachmentSchema = new Schema(
  {
    originalName: { type: String, required: true },
    filename:     { type: String, required: true },
    mimetype:     { type: String, required: true },
    size:         { type: Number, required: true },
    url:          { type: String, required: true }, // p.ej. /uploads/<filename>
  },
  { _id: false }
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
    ref: 'User',
    required: true,
  },
  recipients: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
      ref: 'User',
    },
  ],
  toAllWorkers: {
    type: Boolean,
    default: false,
  },
  // 👇 Nuevo: lista de adjuntos (vacía por defecto)
  attachments: {
    type: [attachmentSchema],
    default: [],
  },
});

const Message = mongoose.model<IMessage>('Message', messageSchema);
export default Message;
