import { useEffect, useState } from "react";
import { UsersApi, type User } from "../../../modules/users";
import type { UserRef } from "../../../modules/diensts";
import type { FlexibleAssignment } from "../../../types/assignment";
import { mergeWithAssigned } from "../../../utils/mergeWithAssigned";
import { ensureSelectedPresent } from "../ensureSelectedPresent";
import { toastT } from "../../../utils/toast";

const toUserRefList = (users: User[]): UserRef[] =>
  users.map((u) => ({
    _id: u._id,
    name: u.name,
    lastName: u.lastName,
    ambulanceRole: u.ambulanceRole,
    pscheinExpiry: u.pscheinExpiry,
  }));

export const useAvailableUsersForAssignment = (params: {
  token: string | null | undefined;
  isAdmin: boolean;
  date: string;
  assignment?: FlexibleAssignment;
  startTime: string;
  endTime: string;
  selectedDriverId: string;
  selectedMedicId: string;
}) => {
  const {
    token,
    isAdmin,
    date,
    assignment,
    startTime,
    endTime,
    selectedDriverId,
    selectedMedicId,
  } = params;

  const [availableDrivers, setAvailableDrivers] = useState<UserRef[]>([]);
  const [availableMedics, setAvailableMedics] = useState<UserRef[]>([]);

  useEffect(() => {
    const fetchAvailableUsers = async () => {
      if (!token || !isAdmin || !date) return;

      try {
        const commonOpts = { startTime, endTime, includeExpired: true };

        const [drivers, medics] = await Promise.all([
          UsersApi.getAvailableUsersForDate(date, "driver", token, commonOpts),
          UsersApi.getAvailableUsersForDate(date, "medic", token, {
            startTime,
            endTime,
          }),
        ]);

        let drv = mergeWithAssigned(toUserRefList(drivers), assignment, "driver");
let med = mergeWithAssigned(toUserRefList(medics), assignment, "medic");


        const driverIdFromAssignment =
          typeof assignment?.driver === "string" ? assignment.driver : undefined;
        const medicIdFromAssignment =
          typeof assignment?.medic === "string" ? assignment.medic : undefined;

        drv = await ensureSelectedPresent(
          drv,
          driverIdFromAssignment ?? selectedDriverId,
          token,
        );
        med = await ensureSelectedPresent(
          med,
          medicIdFromAssignment ?? selectedMedicId,
          token,
        );

        setAvailableDrivers(drv);
        setAvailableMedics(med);
      } catch (error) {
        console.error("Error al cargar usuarios disponibles:", error);
        toastT.error(["toasts.assignments.loadUsersError"]);
      }
    };

    fetchAvailableUsers();
  }, [
    token,
    isAdmin,
    date,
    assignment,
    startTime,
    endTime,
    selectedDriverId,
    selectedMedicId,
  ]);

  return { availableDrivers, availableMedics };
};
