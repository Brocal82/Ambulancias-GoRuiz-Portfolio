// src/modules/messages/domain/types.ts

export interface MessageAttachment {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string; // e.g. /uploads/attachment-123.jpg
}

export interface Message {
  _id: string;
  subject: string;
  body: string;
  sender: {
    _id: string;
    name: string;
    lastName: string;
  };
  recipients: string[];
  sentAt: string;
  readBy: string[];
  toAllWorkers?: boolean;
  attachments?: MessageAttachment[]; // 👈 nuevo, opcional
}
