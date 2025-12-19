export interface ClosedMonth {
  year: number;
  month: number; // 1..12
}

export function getLastClosedMonths(count = 12): ClosedMonth[] {
  const now = new Date();

  // empezamos desde el mes anterior (mes cerrado)
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const result: ClosedMonth[] = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() - i, 1);
    result.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }

  return result;
}
