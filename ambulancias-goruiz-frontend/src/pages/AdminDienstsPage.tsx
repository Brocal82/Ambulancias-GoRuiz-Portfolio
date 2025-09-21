import { useCallback, useEffect, useState } from 'react';
import type { Dienst, UserRef } from '../types/dienst';
import { getAllDiensts, generateDienstsForWeek, deleteDienstsForWeek } from '../api/diensts';
import AssignmentModal from '../components/AssignmentModal';
import { isPartialAssignment } from '../utils/assignmentUtils';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { toastT } from "../utils/toast";

// Helpers de render seguro
const displayAmbulance = (a: unknown) =>
  a && typeof a === 'object'
    ? (a as any).ambulanceNumber ?? '—'
    : (typeof a === 'string' && a ? a : '—');

const displayPerson = (p: unknown) =>
  typeof p === 'string'
    ? p
    : p && typeof p === 'object'
      ? `${(p as any).lastName ?? ''}${(p as any).lastName ? ', ' : ''}${(p as any).name ?? ''}` || '—'
      : '—';


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

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);
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
    <div className="min-h-[400px]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('pages.diensts.adminPage.title')}</h1>
      </div>

      {weekStartDates.map((weekStart, index) => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        return (
          <div key={index} className="mb-8 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
            {/* Header de semana */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-700">
                {t('pages.diensts.adminPage.weekRange', {
                  from: fmtDate(weekStart),
                  to: fmtDate(weekEnd)
                })}
              </h2>

              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  onClick={async () => {
                    const confirmCreate = confirm(
                      t('pages.diensts.adminPage.confirmCreate', { date: fmtDate(weekStart) })
                    );
                    if (!confirmCreate || !token) return;

                    const mondayISO = weekStart.toISOString().split("T")[0];

                    try {
                      await generateDienstsForWeek(mondayISO, token);
                      toastT.success(['pages.diensts.adminPage.alerts.createOk']);
                      fetchDiensts();
                    } catch (err) {
                      console.error("Error al crear plantillas:", err);
                      toastT.error(['pages.diensts.adminPage.alerts.createErr']);
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
                      className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100"
                      onClick={async () => {
                        const confirmDelete = confirm(
                          t('pages.diensts.adminPage.confirmDelete', { date: fmtDate(weekStart) })
                        );
                        if (!confirmDelete || !token) return;

                        const mondayISO = weekStart.toISOString().split("T")[0];

                        try {
                          await deleteDienstsForWeek(mondayISO, token);
                          toastT.success(['pages.diensts.adminPage.alerts.deleteOk']);
                          fetchDiensts();
                        } catch (err) {
                          console.error("Error al eliminar diensts:", err);
                          toastT.error(['pages.diensts.adminPage.alerts.deleteErr']);
                        }
                      }}
                    >
                      {t('pages.diensts.adminPage.actions.delete')}
                    </button>
                  )}
              </div>
            </div>

            {/* Listado de diensts de esa semana */}
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
                    <p className="font-medium text-slate-800 mb-2">
                      {t('pages.diensts.adminPage.dienstLabel', { num: dienst.dienstNumber })}
                    </p>

                    {/* Grid de 7 días */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                      {weekDates.map((day) => {
                        const assignment = dienst.assignments.find((a) => a.date === day);
                        const cls = assignment
                          ? isPartialAssignment(assignment)
                            ? 'bg-amber-50 ring-amber-200'
                            : 'bg-blue-50 ring-blue-200'
                          : 'bg-emerald-50 ring-emerald-200';

                        return (
                          <button
                            key={day}
                            type="button"
                            className={`text-left rounded-xl p-3 ring-1 ${cls} hover:shadow-sm hover:-translate-y-0.5 transition`}
                            onClick={() =>
                              setSelectedAssignment({
                                date: day,
                                assignment,
                                dienstId: dienst._id,
                              })
                            }
                          >
                            <p className="text-xs font-semibold text-slate-800 mb-1">
                              {fmtCellDate(day)}
                            </p>
                            {assignment ? (
                              <div className="space-y-0.5 text-xs text-slate-700">
                                <p>🕒 {assignment.startTime} - {assignment.endTime}</p>
                                <p>🚑 {displayAmbulance(assignment?.ambulanceId)}</p>
                                <p>👨‍✈️ {displayPerson(assignment?.driver)}</p>
                                <p>🧑‍⚕️ {displayPerson(assignment?.medic)}</p>
                              </div>

                            ) : (
                              <p className="text-xs text-emerald-800 mt-1">🌴 {t('pages.diensts.adminPage.freeDay')}</p>
                            )}
                          </button>
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
