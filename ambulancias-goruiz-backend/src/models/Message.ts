// backend/src/models/Message.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  subject: string;
  body: string;
  sender: mongoose.Types.ObjectId;
  recipients: mongoose.Types.ObjectId[];
  sentAt: Date;
  readBy: mongoose.Types.ObjectId[];
}

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
});

const Message = mongoose.model<IMessage>('Message', messageSchema);
export default Message;
