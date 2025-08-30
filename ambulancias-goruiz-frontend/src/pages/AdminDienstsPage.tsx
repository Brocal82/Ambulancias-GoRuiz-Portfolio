import { useCallback, useEffect, useState } from 'react';
import type { Dienst, UserRef } from '../types/dienst';
import { getAllDiensts, generateDienstsForWeek, deleteDienstsForWeek } from '../api/diensts';
import AssignmentModal from '../components/AssignmentModal';
import { isPartialAssignment } from '../utils/assignmentUtils';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';

const AdminPage = () => {
  const [diensts, setDiensts] = useState<Dienst[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: Dienst["assignments"][0] & {
      driver: string | UserRef;
      medic: string | UserRef;
    };
    dienstId: string;
  } | null>(null);

  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(i18n.language);

  const fmtCellDate = (isoDay: string) =>
    new Date(isoDay).toLocaleDateString(i18n.language, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

  const fetchDiensts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAllDiensts(token);
      const plantillas = data.filter((d) => d.dienstNumber >= 1 && d.dienstNumber <= 10);
      setDiensts(plantillas);
    } catch (error) {
      console.error("Error al obtener los diensts:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchDiensts();
  }, [fetchDiensts]);

  const getWeekStartDates = () => {
    const today = new Date();
    const monday = new Date(today);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
    return [0, 1, 2].map((i) => {
      const copy = new Date(monday);
      copy.setDate(copy.getDate() + i * 7);
      return copy;
    });
  };

  const weekStartDates = getWeekStartDates();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{t('pages.diensts.adminPage.title')}</h1>

      {weekStartDates.map((weekStart, index) => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        return (
          <div key={index} className="mb-10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">
                {t('pages.diensts.adminPage.weekRange', {
                  from: fmtDate(weekStart),
                  to: fmtDate(weekEnd)
                })}
              </h2>

              <div className="flex gap-2">
                <button
                  className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                  onClick={async () => {
                    const confirmCreate = confirm(
                      t('pages.diensts.adminPage.confirmCreate', { date: fmtDate(weekStart) })
                    );
                    if (!confirmCreate || !token) return;

                    const mondayISO = weekStart.toISOString().split("T")[0];

                    try {
                      await generateDienstsForWeek(mondayISO, token);
                      alert(t('pages.diensts.adminPage.alerts.createOk'));
                      fetchDiensts();
                    } catch (err) {
                      console.error("Error al crear plantillas:", err);
                      alert(t('pages.diensts.adminPage.alerts.createErr'));
                    }
                  }}
                >
                  {t('pages.diensts.adminPage.actions.create')}
                </button>

                {diensts.some(d => {
                  if (!d.weekStartDate) return false;
                  const parsedDate = new Date(d.weekStartDate);
                  return !isNaN(parsedDate.getTime()) &&
                    parsedDate.toISOString().split("T")[0] === weekStart.toISOString().split("T")[0];
                }) && (
                  <button
                    className="text-sm bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
                    onClick={async () => {
                      const confirmDelete = confirm(
                        t('pages.diensts.adminPage.confirmDelete', { date: fmtDate(weekStart) })
                      );
                      if (!confirmDelete || !token) return;

                      const mondayISO = weekStart.toISOString().split("T")[0];

                      try {
                        await deleteDienstsForWeek(mondayISO, token);
                        alert(t('pages.diensts.adminPage.alerts.deleteOk'));
                        fetchDiensts();
                      } catch (err) {
                        console.error("Error al eliminar diensts:", err);
                        alert(t('pages.diensts.adminPage.alerts.deleteErr'));
                      }
                    }}
                  >
                    {t('pages.diensts.adminPage.actions.delete')}
                  </button>
                )}
              </div>
            </div>

            {diensts
              .filter((dienst) => {
                if (!dienst.weekStartDate) return false;
                const parsedDate = new Date(dienst.weekStartDate);
                return !isNaN(parsedDate.getTime()) &&
                  parsedDate.toISOString().split("T")[0] === weekStart.toISOString().split("T")[0];
              })
              .map((dienst) => {
                const weekDates = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() + i);
                  return d.toISOString().split("T")[0];
                });

                return (
                  <div key={`${weekStart.toISOString()}-${dienst.dienstNumber}`} className="mb-6">
                    <p className="font-semibold text-md mb-1">
                      {t('pages.diensts.adminPage.dienstLabel', { num: dienst.dienstNumber })}
                    </p>
                    <div className="grid grid-cols-7 gap-2">
                      {weekDates.map((day) => {
                        const assignment = dienst.assignments.find((a) => a.date === day);
                        const bgColor = assignment
                          ? isPartialAssignment(assignment)
                            ? "bg-yellow-100"
                            : "bg-blue-100"
                          : "bg-green-100";

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
                            <p className="font-semibold">
                              {fmtCellDate(day)}
                            </p>
                            {assignment ? (
                              <>
                                <p className="text-xs">🕒 {assignment.startTime} - {assignment.endTime}</p>
                                <p className="text-xs">
                                  🚑{" "}
                                  {typeof assignment.ambulanceId === "object" && "ambulanceNumber" in assignment.ambulanceId
                                    ? assignment.ambulanceId.ambulanceNumber
                                    : typeof assignment.ambulanceId === "string" && assignment.ambulanceId.length > 0
                                      ? assignment.ambulanceId
                                      : "—"}
                                </p>
                                <p className="text-xs">
                                  👨‍✈️{" "}
                                  {typeof assignment.driver === "string"
                                    ? assignment.driver
                                    : assignment.driver
                                      ? `${assignment.driver.lastName}, ${assignment.driver.name}`
                                      : "—"}
                                </p>
                                <p className="text-xs">
                                  🧑‍⚕️{" "}
                                  {typeof assignment.medic === "string"
                                    ? assignment.medic
                                    : assignment.medic
                                      ? `${assignment.medic.lastName}, ${assignment.medic.name}`
                                      : "—"}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-green-800 mt-2">🌴 {t('pages.diensts.adminPage.freeDay')}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        );
      })}

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

export default AdminPage;
