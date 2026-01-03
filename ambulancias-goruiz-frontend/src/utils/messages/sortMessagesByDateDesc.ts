// frontend/src/utils/messages/sortMessagesByDateDesc.ts
import type { Message } from "../../types/message";

export const sortMessagesByDateDesc = (messages: Message[]): Message[] => {
  return [...messages].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
};

