type ReadByMessage = {
  readBy?: ReadonlyArray<string | { toString(): string }>;
};

export function countUnreadMessages<T extends ReadByMessage>(
  messages: ReadonlyArray<T>,
  userId: string,
): number {
  const normalizedUserId = String(userId);
  return messages.reduce((acc, message) => {
    const isUnread = !(message.readBy ?? []).some((id) => String(id) === normalizedUserId);
    return isUnread ? acc + 1 : acc;
  }, 0);
}
