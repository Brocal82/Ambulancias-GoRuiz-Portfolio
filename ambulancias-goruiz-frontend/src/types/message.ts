// frontend/src/types/message.ts
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
}
