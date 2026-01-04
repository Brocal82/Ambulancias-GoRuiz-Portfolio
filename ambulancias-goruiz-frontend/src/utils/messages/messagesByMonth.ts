// frontend/src/utils/messages/messagesByMonth.ts
import type { Message } from "../../types/message";

/**
 * Devuelve true si msg.sentAt cae dentro del año/mes (monthIndex: 0..11)
 */
export function isMessageInYearMonth(
  msg: Message,
  year: number,
  monthIndex: number,
): boolean {
  const d = new Date(msg.sentAt);
  return d.getFullYear() === year && d.getMonth() === monthIndex;
}

/**
 * Filtra mensajes del año/mes (monthIndex: 0..11)
 */
export function filterMessagesByYearMonth(
  messages: Message[],
  year: number,
  monthIndex: number,
): Message[] {
  return messages.filter((m) => isMessageInYearMonth(m, year, monthIndex));
}

/**
 * Calcula contadores por mes para un año:
 * - total: nº de mensajes en ese mes
 * - unread: nº de mensajes no leídos por `meId` (si se proporciona)
 *
 * Nota:
 * - En Admin "sent", normalmente no aplica unread por user, pero
 *   la función soporta meId para Worker (readBy).
 */
export function buildCountsByMonthForYear(
  messages: Message[],
  year: number,
  meId?: string | null,
): Record<number, { total: number; unread: number }> {
  const out: Record<number, { total: number; unread: number }> = {};

  // inicializar 0..11
  for (let i = 0; i < 12; i++) out[i] = { total: 0, unread: 0 };

  for (const msg of messages) {
    const d = new Date(msg.sentAt);
    if (d.getFullYear() !== year) continue;

    const m = d.getMonth();
    out[m].total += 1;

    if (meId) {
      const readBy = (msg.readBy as unknown as string[]) || [];
      const isUnread = !readBy.some((u) => String(u) === String(meId));
      if (isUnread) out[m].unread += 1;
    }
  }

  return out;
}
