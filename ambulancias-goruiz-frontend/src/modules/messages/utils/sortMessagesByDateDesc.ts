// src/modules/messages/utils/sortMessagesByDateDesc.ts
import type { Message } from "../domain/types";

export const sortMessagesByDateDesc = (messages: Message[]): Message[] => {
  return [...messages].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
};

