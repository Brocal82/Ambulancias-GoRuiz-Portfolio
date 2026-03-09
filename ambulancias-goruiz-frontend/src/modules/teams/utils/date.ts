export const getBerlinYMD = (d: Date) => {
  const y = Number(
    d.toLocaleString("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
    }),
  );

  const m = Number(
    d.toLocaleString("en-CA", {
      timeZone: "Europe/Berlin",
      month: "2-digit",
    }),
  );

  const day = Number(
    d.toLocaleString("en-CA", {
      timeZone: "Europe/Berlin",
      day: "2-digit",
    }),
  );

  return { y, m, day };
};

export const toISO = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Semana actual (Lun→Dom) en Berlin
export const getBerlinWeekRangeISO = () => {
  const now = new Date();
  const { y, m, day } = getBerlinYMD(now);

  const todayUTC = new Date(Date.UTC(y, m - 1, day));
  const dow = todayUTC.getUTCDay(); // 0=Dom, 1=Lun, ... 6=Sáb
  const diffToMonday = dow === 0 ? -6 : 1 - dow;

  const mondayUTC = new Date(Date.UTC(y, m - 1, day + diffToMonday));
  const sundayUTC = new Date(Date.UTC(y, m - 1, day + diffToMonday + 6));

  return {
    weekStartISO: toISO(
      mondayUTC.getUTCFullYear(),
      mondayUTC.getUTCMonth() + 1,
      mondayUTC.getUTCDate(),
    ),
    weekEndISO: toISO(
      sundayUTC.getUTCFullYear(),
      sundayUTC.getUTCMonth() + 1,
      sundayUTC.getUTCDate(),
    ),
  };
};