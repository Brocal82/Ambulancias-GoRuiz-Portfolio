// src/pages/DienstPage.tsx
import { useCallback, useEffect, useState } from "react";
import { getDienstByUser } from "../modules/diensts";
import type { Dienst, UserRef } from "../modules/diensts";
import AssignmentModal from "../components/AssignmentModal";
import { isPartialAssignment } from "../utils/assignmentUtils";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";

const DienstPage = () => {
  const { userId, token } = useAuth();
  const { t, i18n } = useTranslation();

  const [diensts, setDiensts] = useState<Dienst[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: Dienst["assignments"][0] & {
      driver: string | UserRef;
      medic: string | UserRef;
    };
    dienstId: string;
  } | null>(null);

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);
  const fmtCellDate = (isoDay: string) =>
    new Date(isoDay).toLocaleDateString(i18n.language, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

  const fetchDiensts = useCallback(async () => {
    if (!userId || !token) return;
    try {
      const data = await getDienstByUser(userId, token);
      setDiensts(data);
    } catch (error) {
      console.error("Error al obtener los diensts:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    fetchDiensts();
  }, [fetchDiensts]);

  if (loading) return <p>{t("pages.diensts.dienstPage.loading")}</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">
        {t("pages.diensts.dienstPage.title")}
      </h2>

      <ul className="space-y-8">
        {diensts.map((dienst) => {
          // rango de 14 días desde el inicio
          const start = new Date(dienst.weekStartDate);
          const end = new Date(start);
          end.setDate(end.getDate() + 13);

          const allWeekDates = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            return d.toISOString().split("T")[0];
          });

          return (
            <li key={dienst.dienstNumber}>
              <div className="mb-2">
                <p className="text-lg font-semibold">
                  {t("pages.diensts.adminPage.dienstLabel", {
                    num: dienst.dienstNumber,
                  })}
                </p>
                <p className="mb-2 text-sm text-gray-600">
                  {t("pages.diensts.dienstPage.range", {
                    from: fmtDate(start),
                    to: fmtDate(end),
                  })}
                </p>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {allWeekDates.map((day) => {
                  const assignment = dienst.assignments.find(
                    (a) => a.date === day,
                  );
                  const bgColor = assignment
                    ? isPartialAssignment(assignment)
                      ? "bg-yellow-100" // parcialmente asignado
                      : "bg-blue-100" // completamente asignado
                    : "bg-green-100"; // día libre

                  return (
                    <div
                      key={day}
                      className={`border rounded p-2 text-sm cursor-pointer hover:shadow ${bgColor}`}
                      onClick={() =>
                        setSelectedAssignment({
                          date: day,
                          assignment,
                          dienstId: dienst._id,
                        })
                      }
                    >
                      <p className="font-semibold">{fmtCellDate(day)}</p>

                      {assignment ? (
                        <>
                          <p className="text-xs">
                            🕒 {assignment.startTime} - {assignment.endTime}
                          </p>
                          <p className="text-xs">
                            🚑{" "}
                            {typeof assignment.ambulanceId === "object" &&
                              "ambulanceNumber" in assignment.ambulanceId
                              ? assignment.ambulanceId.ambulanceNumber
                              : "—"}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-green-800 font-medium mt-2">
                          🌴 {t("pages.diensts.dienstPage.freeDay")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      {selectedAssignment && (
        <AssignmentModal
          isOpen={true}
          date={selectedAssignment.date}
          assignment={selectedAssignment.assignment}
          dienstId={selectedAssignment.dienstId}
          onClose={() => setSelectedAssignment(null)}
          onUpdate={fetchDiensts}
        />
      )}
    </div>
  );
};

export default DienstPage;
