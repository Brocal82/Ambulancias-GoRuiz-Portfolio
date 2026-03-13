import { useCallback, useEffect, useState } from "react";
import { getTripsByDate } from "../domain";
import type { Trip } from "../domain/types/trip";
import { toastT } from "../../../utils/toast";

const getClosedDayKeyByDate = (date: string, uid?: string) =>
  `workdayClosed-${date}-${uid ?? "anon"}`;

export const useWorkdayTrips = (args: {
  token?: string | null;
  userId?: string;
  date: string; // YYYY-MM-DD
}) => {
  const { token, userId, date } = args;

  const [trips, setTrips] = useState<Trip[]>([]);
  const [isClosingDay, setIsClosingDay] = useState(false);

  const refreshTrips = useCallback(async () => {
    if (!token || !userId) return;

    const closedKey = getClosedDayKeyByDate(date, userId);
    const closedFlag = localStorage.getItem(closedKey);
    if (closedFlag === "true") {
      setTrips([]);
      setIsClosingDay(true);
      return;
    }

    try {
      const data = await getTripsByDate(date, token);
      const pending = data.filter((t) => !t.sentInSummary);
      const mine = pending.filter((t) => t.driver === userId || t.medic === userId);
      setTrips(mine);
      setIsClosingDay(false);
    } catch (err) {
      console.error(err);
      toastT.error(["toasts.workday.loadTripsError"]);
    }
  }, [token, userId, date]);

  useEffect(() => {
    if (!userId) return;
    const closedKey = getClosedDayKeyByDate(date, userId);
    const closedFlag = localStorage.getItem(closedKey);
    setIsClosingDay(closedFlag === "true");
    if (closedFlag === "true") setTrips([]);
  }, [date, userId]);

  useEffect(() => {
    refreshTrips();
  }, [refreshTrips]);

  return {
    trips,
    setTrips, // para que MyWorkDay pueda añadir trips tras createTrip sin cambiar tu flujo
    isClosingDay,
    refreshTrips,
    getClosedDayKeyByDate,
  };
};
