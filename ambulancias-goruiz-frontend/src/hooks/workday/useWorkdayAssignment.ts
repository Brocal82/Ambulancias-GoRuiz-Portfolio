import { useCallback, useEffect, useState } from "react";
import { getAssignedDaysForUser } from "../../modules/diensts";
import type { AssignedDay, AssignedDayFull } from "../../modules/diensts";
import { toastT } from "../../utils/toast";

/** ¿El Dienst cruza medianoche? */
const crossesMidnight = (start: string, end: string) => {
  const [sh] = start.split(":").map(Number);
  const [eh] = end.split(":").map(Number);
  return eh < sh;
};

/** ¿AHORA mismo dentro del Dienst (soporta nocturno que empezó ayer)? */
const isNowWithinDienst = (
  dienst: Pick<AssignedDayFull, "date" | "startTime" | "endTime">,
) => {
  const now = new Date();
  const [sH, sM] = dienst.startTime.split(":").map(Number);
  const [eH, eM] = dienst.endTime.split(":").map(Number);

  const start = new Date(dienst.date + "T00:00:00");
  start.setHours(sH, sM, 0, 0);

  const end = new Date(dienst.date + "T00:00:00");
  end.setHours(eH, eM, 0, 0);
  if (crossesMidnight(dienst.startTime, dienst.endTime)) {
    end.setDate(end.getDate() + 1);
  }

  return now >= start && now <= end;
};

/** Devuelve true si AHORA ya se pueden registrar viajes. (30 min antes) */
const canStartTripNow = (startTime: string, dienstDate: string): boolean => {
  const [sh, sm] = startTime.split(":").map(Number);
  const start = new Date(dienstDate + "T00:00:00");
  start.setHours(sh, sm - 30, 0, 0);
  const now = new Date();
  return now >= start;
};

const toAssignedDayFullSafe = (days: AssignedDay[]): AssignedDayFull[] => {
  return days.reduce<AssignedDayFull[]>((acc, d) => {
    if (!d.driver || !d.medic) return acc;
    if (typeof d.driver === "string" || typeof d.medic === "string") return acc;

    acc.push({
      dienstId: d.dienstId,
      dienstNumber: d.dienstNumber,
      assignmentId: d.assignmentId,
      date: d.date,
      startTime: d.startTime,
      endTime: d.endTime,
      ambulanceId: d.ambulanceId,
      ambulanceNumber: d.ambulanceNumber,
      driver: d.driver,
      medic: d.medic,
    });

    return acc;
  }, []);
};

export const useWorkdayAssignment = (args: {
  token?: string | null;
  userId?: string;
  today: string; // YYYY-MM-DD
}) => {
  const { token, userId, today } = args;

  const [assignedDay, setAssignedDay] = useState<AssignedDayFull | null>(null);
  const [canStartWork, setCanStartWork] = useState(false);

  const refreshAssignedDay = useCallback(async () => {
    if (!token || !userId) return;

    try {
      const daysRaw = await getAssignedDaysForUser(userId, token);
      const daysFull = toAssignedDayFullSafe(daysRaw);

      let todayAssignment = daysFull.find((d) => d.date === today);

      if (!todayAssignment) {
        const yesterdayStr = new Date(Date.now() - 86_400_000)
          .toISOString()
          .split("T")[0];

        const yestAssignment = daysFull.find((d) => d.date === yesterdayStr);

        if (
          yestAssignment &&
          crossesMidnight(yestAssignment.startTime, yestAssignment.endTime) &&
          isNowWithinDienst(yestAssignment)
        ) {
          todayAssignment = yestAssignment;
        }
      }

      if (todayAssignment) {
        setAssignedDay(todayAssignment);
        setCanStartWork(canStartTripNow(todayAssignment.startTime, todayAssignment.date));
      } else {
        setAssignedDay(null);
        setCanStartWork(false);
      }
    } catch (err) {
      console.error(err);
      toastT.error(["toasts.workday.loadAssignmentError"]);
    }
  }, [token, userId, today]);

  useEffect(() => {
    refreshAssignedDay();
  }, [refreshAssignedDay]);

  return {
    assignedDay,
    canStartWork,
    refreshAssignedDay,
  };
};
