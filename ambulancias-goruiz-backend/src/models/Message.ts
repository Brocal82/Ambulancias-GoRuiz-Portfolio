import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  subject: string;
  body: string;
  sender: mongoose.Types.ObjectId;
  recipients: mongoose.Types.ObjectId[];
  sentAt: Date;
  readBy: mongoose.Types.ObjectId[];
  removedBy: mongoose.Types.ObjectId[]; // 👈 NUEVO: oculto para estos usuarios
  toAllWorkers?: boolean;
  attachments?: {
    originalName: string;
    filename: string;
    mimetype: string;
    size: number;
    url: string;
  }[];
}

// Subesquema para adjuntos (sin _id)
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
  removedBy: [ // 👈 NUEVO: quién lo ha “eliminado” de su vista
    {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
  ],
  toAllWorkers: {
    type: Boolean,
    default: false,
  },
  // Lista de adjuntos (vacía por defecto)
  attachments: {
    type: [attachmentSchema],
    default: [],
  },
});

// Índices útiles
messageSchema.index({ recipients: 1, sentAt: -1 }); // ✅ array + escalar (OK)
messageSchema.index({ readBy: 1 });                 // ✅ un solo array (OK)
messageSchema.index({ removedBy: 1 });              // ✅ un solo array (OK)

const Message = mongoose.model<IMessage>('Message', messageSchema);
export default Message;
