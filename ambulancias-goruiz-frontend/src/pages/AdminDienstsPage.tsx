// frontend/src/pages/AdminDienstsPage.tsx
import { useCallback, useEffect, useState } from 'react';
import type { Dienst, UserRef } from '../types/dienst';
import {
  getAllDiensts,
  generateDienstsForWeek,
  deleteDienstsForWeek,
  assignTeamToWeek,
  assignUserToWeek,
  clearPeopleForWeek,
  swapWeekRoles
} from '../api/diensts';
import AssignmentModal from '../components/AssignmentModal';
import TeamAssignModal from '../components/diensts/TeamAssignModal';
import UserAssignModal from '../components/diensts/UserAssignModal';
import { isPartialAssignment, isTeamIncomplete } from '../utils/assignmentUtils';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { toastT } from "../utils/toast";
import { getPscheinInfo, getPscheinWarningTitle } from '../utils/pscheinUtils';
import { formatCellDateUnified } from '../utils/timeUtils';

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

  // ⬇️ estado local para el modal de asignar Team a la semana
  const [weekTeamModal, setWeekTeamModal] = useState<{
    open: boolean;
    dienstNumber: number;
    weekStartISO: string;
  } | null>(null);

  const [weekUserModal, setWeekUserModal] = useState<{
    open: boolean;
    weekStartISO: string;
    dienstNumber: number;
  } | null>(null);

  // Estado para colapsar/desplegar semanas (key = weekStartISO)
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>({});

  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);

  const toggleWeekCollapsed = (weekKey: string) => {
    setCollapsedWeeks((prev) => ({
      ...prev,
      [weekKey]: !prev[weekKey],
    }));
  };

  const fetchDiensts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAllDiensts(token);

      // ✅ Nos quedamos con todos los Diensts con número >= 1
      //    y los ordenamos por número ascendente.
      const normalized = data
        .filter((d) => typeof d.dienstNumber === 'number' && d.dienstNumber >= 1)
        .sort((a, b) => a.dienstNumber - b.dienstNumber);

      setDiensts(normalized);
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('pages.diensts.adminPage.title')}
        </h1>
      </div>

      {weekStartDates.map((weekStart, index) => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekStartISO = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        const isCollapsed = collapsedWeeks[weekStartISO] ?? false;
        const hasWeekDiensts = diensts.some(d => {
          if (!d.weekStartDate) return false;
          const parsedDate = new Date(d.weekStartDate);
          return (
            !isNaN(parsedDate.getTime()) &&
            parsedDate.toISOString().split("T")[0] === weekStartISO
          );
        });


        return (
          <div
            key={index}
            className="mb-8 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4"
          >
                        {/* Header de semana */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
              {hasWeekDiensts ? (
                // Si hay Diensts: header clicable con flecha 🔼 / 🔽
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 focus:outline-none"
                  onClick={() => toggleWeekCollapsed(weekStartISO)}
                  aria-expanded={!isCollapsed}
                >
                  <span>
                    {t('pages.diensts.adminPage.weekRange', {
                      from: fmtDate(weekStart),
                      to: fmtDate(weekEnd)
                    })}
                  </span>
                  <span className="text-xs">
                    {isCollapsed ? '🔽' : '🔼'}
                  </span>
                </button>
              ) : (
                // Si NO hay Diensts: solo texto, sin flecha y sin onClick
                <h2 className="text-sm font-medium text-slate-700">
                  {t('pages.diensts.adminPage.weekRange', {
                    from: fmtDate(weekStart),
                    to: fmtDate(weekEnd)
                  })}
                </h2>
              )}

              <div className="flex flex-wrap gap-2">
                {/* Mostrar botón Crear solo si NO existen Diensts esa semana */}
                {!hasWeekDiensts && (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                    onClick={async () => {
                      const confirmCreate = confirm(
                        t('pages.diensts.adminPage.confirmCreate', { date: fmtDate(weekStart) })
                      );
                      if (!confirmCreate || !token) return;

                      try {
                        await generateDienstsForWeek(weekStartISO, token);
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
                )}

                {/* Mostrar botón Borrar solo si EXISTEN Diensts esa semana */}
                {hasWeekDiensts && (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-500/90 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-200 transition-colors"
                    onClick={async () => {
                      const confirmDelete = confirm(
                        t('pages.diensts.adminPage.confirmDelete', { date: fmtDate(weekStart) })
                      );
                      if (!confirmDelete || !token) return;

                      try {
                        await deleteDienstsForWeek(weekStartISO, token);
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
            {!isCollapsed && (
              <>
                {diensts
                  .filter((dienst) => {
                    if (!dienst.weekStartDate) return false;
                    const parsedDate = new Date(dienst.weekStartDate);
                    return (
                      !isNaN(parsedDate.getTime()) &&
                      parsedDate.toISOString().split("T")[0] === weekStartISO
                    );
                  })
                  .map((dienst) => {
                    const weekDates = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(weekStart);
                      d.setDate(d.getDate() + i);
                      return d.toISOString().split("T")[0];
                    });

                    // ✅ Mostrar swap/clear solo si hay alguien asignado en la semana
                    const hasAnyPersonAssigned =
                      Array.isArray(dienst.assignments) &&
                      dienst.assignments.some(
                        (a) => a?.date && a?.startTime && a?.endTime && (a.driver || a.medic)
                      );

                    return (
                      <div
                        key={`${weekStart.toISOString()}-${dienst.dienstNumber}`}
                        className="mb-6"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-slate-800">
                            {t('pages.diensts.adminPage.dienstLabel', { num: dienst.dienstNumber })}
                          </p>

                          {/* Grupo de iconos de acciones */}
                          <div className="flex items-center gap-3">
                            {/* 👤 Asignar un trabajador (siempre visible) */}
                            <button
                              className="flex items-center justify-center w-6 h-6 text-slate-600 hover:text-slate-900 transition-transform transform hover:scale-110 focus:outline-none"
                              title={t('pages.diensts.adminPage.assignUserToWeek')}
                              onClick={() =>
                                setWeekUserModal({
                                  open: true,
                                  dienstNumber: dienst.dienstNumber,
                                  weekStartISO,
                                })
                              }
                            >
                              <span
                                aria-hidden
                                className="block text-[16px] leading-none translate-y-[1px] scale-[0.95]"
                              >
                                👤
                              </span>
                              <span className="sr-only">
                                {t('pages.diensts.adminPage.assignUserToWeek')}
                              </span>
                            </button>

                            {/* 👥 Asignar pareja (siempre visible) */}
                            <button
                              className="flex items-center justify-center w-6 h-6 text-slate-600 hover:text-slate-900 transition-transform transform hover:scale-110 focus:outline-none"
                              title={t('pages.diensts.adminPage.assignTeamToWeek')}
                              onClick={() =>
                                setWeekTeamModal({
                                  open: true,
                                  dienstNumber: dienst.dienstNumber,
                                  weekStartISO,
                                })
                              }
                            >
                              <span
                                aria-hidden
                                className="block text-[18px] leading-none -translate-y-[1px] scale-[1.12]"
                              >
                                👥
                              </span>
                              <span className="sr-only">
                                {t('pages.diensts.adminPage.assignTeamToWeek')}
                              </span>
                            </button>

                            {/* ⇅ Intercambiar roles (solo si hay alguien asignado) */}
                            {hasAnyPersonAssigned && (
                              <button
                                className="flex items-center justify-center w-6 h-6 text-slate-600 hover:text-slate-900 transition-transform transform hover:scale-110 focus:outline-none"
                                title={t('pages.diensts.adminPage.swapRolesWeek')}
                                onClick={async () => {
                                  if (!token) return;
                                  const ok = confirm(
                                    t('pages.diensts.adminPage.confirmSwap', {
                                      num: dienst.dienstNumber,
                                      date: fmtDate(weekStart),
                                    }) as string
                                  );
                                  if (!ok) return;

                                  try {
                                    await swapWeekRoles(
                                      { dienstNumber: dienst.dienstNumber, weekStartDate: weekStartISO },
                                      token
                                    );
                                    toastT.success(['pages.diensts.adminPage.swapWeekOk']);
                                    fetchDiensts();
                                  } catch (err: any) {
                                    const code = err?.response?.data?.code as string | undefined;

                                    if (code === 'swap_not_permitted') {
                                      // 🚫 Caso específico: roles no compatibles o P-Schein caducado
                                      toastT.error([
                                        'pages.diensts.adminPage.swapWeekNotPermitted',
                                      ]);
                                      console.warn(
                                        '⚠️ swap_not_permitted details:',
                                        err?.response?.data?.details
                                      );
                                    } else {
                                      // ❌ Error genérico
                                      console.error('❌ Error en swapWeekRoles:', err);
                                      toastT.error(['pages.diensts.adminPage.swapWeekErr']);
                                    }
                                  }
                                }}
                              >
                                <span
                                  aria-hidden
                                  className="block text-[16px] leading-none translate-y-[1px]"
                                >
                                  ⇅
                                </span>
                                <span className="sr-only">
                                  {t('pages.diensts.adminPage.swapRolesWeek')}
                                </span>
                              </button>
                            )}

                            {/* 🧽 Limpiar asignaciones (solo si hay alguien asignado) */}
                            {hasAnyPersonAssigned && (
                              <button
                                className="flex items-center justify-center w-6 h-6 text-slate-600 hover:text-rose-700 transition-transform transform hover:scale-110 focus:outline-none"
                                title={t('pages.diensts.adminPage.clearWeekPeople')}
                                onClick={async () => {
                                  if (!token) return;
                                  const ok = confirm(
                                    t('pages.diensts.adminPage.confirmClear', {
                                      num: dienst.dienstNumber,
                                      date: fmtDate(weekStart),
                                    }) as string
                                  );
                                  if (!ok) return;

                                  try {
                                    await clearPeopleForWeek(
                                      { dienstNumber: dienst.dienstNumber, weekStartDate: weekStartISO },
                                      token
                                    );
                                    toastT.success(['pages.diensts.adminPage.clearOk']);
                                    fetchDiensts();
                                  } catch (err) {
                                    console.error(err);
                                    toastT.error(['pages.diensts.adminPage.clearErr']);
                                  }
                                }}
                              >
                                <span
                                  aria-hidden
                                  className="block text-[17px] leading-none translate-y-[0.5px]"
                                >
                                  🧽
                                </span>
                                <span className="sr-only">
                                  {t('pages.diensts.adminPage.clearWeekPeople')}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Grid de 7 días */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                          {weekDates.map((day) => {
                            const assignment = dienst.assignments.find((a) => a.date === day);
                            const cls = assignment
                              ? isPartialAssignment(assignment)
                                ? 'bg-amber-50 ring-amber-200'
                                : 'bg-blue-50 ring-blue-200'
                              : 'bg-emerald-50 ring-emerald-200';
                            const incompleteBorderClass =
                              assignment && isTeamIncomplete(assignment)
                                ? 'border-2 border-red-500'
                                : 'border border-transparent';

                            return (
                              <button
                                key={day}
                                type="button"
                                className={`text-left rounded-xl p-3 ring-1 ${cls} ${incompleteBorderClass} hover:shadow-sm hover:-translate-y-0.5 transition`}
                                onClick={() =>
                                  setSelectedAssignment({
                                    date: day,
                                    assignment,
                                    dienstId: dienst._id,
                                  })
                                }
                              >
                                <p className="text-xs font-semibold text-slate-800 mb-1">
                                  {formatCellDateUnified(day, i18n.language)}
                                </p>
                                {assignment ? (
                                  <div className="space-y-0.5 text-xs text-slate-700">
                                    <p>
                                      🕒 {assignment.startTime} - {assignment.endTime}
                                    </p>
                                    <p>🚑 {displayAmbulance(assignment?.ambulanceId)}</p>

                                    {/* Conductor: rojo si P-Schein caducado; ámbar si warning */}
                                    <p>
                                      👨‍✈️{' '}
                                      {(() => {
                                        let drvClass = '';
                                        let drvTitle: string | undefined = undefined;

                                        if (typeof assignment.driver === 'object' && assignment.driver) {
                                          const info = getPscheinInfo(
                                            (assignment.driver as any).pscheinExpiry
                                          );
                                          if (info.status === 'expired') {
                                            drvClass = 'text-red-600 font-medium';
                                          } else if (info.status === 'warning') {
                                            drvClass = 'text-amber-600 font-medium';
                                          }
                                          drvTitle = getPscheinWarningTitle(
                                            (assignment.driver as any).pscheinExpiry,
                                            t as any
                                          ) || undefined;
                                        }

                                        return (
                                          <span className={drvClass} title={drvTitle}>
                                            {displayPerson(assignment?.driver)}
                                          </span>
                                        );
                                      })()}
                                    </p>

                                    <p>🧑‍⚕️ {displayPerson(assignment?.medic)}</p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-emerald-800 mt-1">
                                    🌴 {t('pages.diensts.adminPage.freeDay')}
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
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

      {/* Modal Team semana */}
      {weekTeamModal?.open && (
        <TeamAssignModal
          isOpen={true}
          onClose={() => setWeekTeamModal(null)}
          onConfirm={async (teamId: string, resolvedRoles) => {
            if (!token || !weekTeamModal) return;
            try {
              const resp = await assignTeamToWeek(
                {
                  dienstNumber: weekTeamModal.dienstNumber,
                  weekStartDate: weekTeamModal.weekStartISO,
                  teamId,
                  resolvedRoles,
                },
                token
              );

              toastT.success(['pages.diensts.adminPage.assignWeekOk']);

              if (resp?.hints?.driverExpiredButBoth) {
                toastT.info(['pages.diensts.adminPage.considerSwap']);
              }

              setWeekTeamModal(null);
              fetchDiensts();
            } catch (err: any) {
              const code = err?.response?.data?.code as string | undefined;
              const details = err?.response?.data?.details;

              if (code === 'pschein_expired') {
                toastT.error(['pages.diensts.adminPage.errors.pscheinExpired']);
              } else if (code === 'weekly_conflict') {
                let driverDates = '';
                let medicDates = '';

                if (Array.isArray(details)) {
                  driverDates = details
                    .filter((d: any) => d?.role === 'driver')
                    .map((d: any) => d?.date)
                    .filter(Boolean)
                    .join(', ');
                  medicDates = details
                    .filter((d: any) => d?.role === 'medic')
                    .map((d: any) => d?.date)
                    .filter(Boolean)
                    .join(', ');
                } else if (details && typeof details === 'object') {
                  const drv = Array.isArray(details.driverConf) ? details.driverConf : [];
                  const med = Array.isArray(details.medicConf) ? details.medicConf : [];
                  driverDates = drv.map((d: any) => d?.date).filter(Boolean).join(', ');
                  medicDates = med.map((d: any) => d?.date).filter(Boolean).join(', ');
                }

                if (driverDates || medicDates) {
                  toastT.error([
                    'pages.diensts.adminPage.teamWeeklyConflictWithDates',
                    { driverDates, medicDates },
                  ]);
                } else {
                  toastT.error(['pages.diensts.adminPage.teamWeeklyConflict']);
                }
              } else {
                toastT.error(['pages.diensts.adminPage.assignWeekErr']);
              }

              console.error('assignTeamToWeek error:', err?.response?.data || err);
            }
          }}
          weekStartISO={weekTeamModal.weekStartISO}
          dienstNumber={weekTeamModal.dienstNumber}
        />
      )}

      {/* Modal Usuario semana */}
      {weekUserModal?.open && (
        <UserAssignModal
          isOpen={true}
          onClose={() => setWeekUserModal(null)}
          onConfirm={async ({ role, userId }) => {
            if (!token || !weekUserModal) return;

            try {
              await assignUserToWeek(
                {
                  dienstNumber: weekUserModal.dienstNumber,
                  weekStartDate: weekUserModal.weekStartISO,
                  role,
                  userId,
                },
                token
              );

              toastT.success(['pages.diensts.adminPage.assignUserWeekOk']);
              setWeekUserModal(null);
              fetchDiensts();
            } catch (err: any) {
              console.error('❌ Error al asignar usuario a la semana:', err);

              if (err?.response?.data?.code === 'weekly_conflict') {
                toastT.error(['pages.diensts.adminPage.assignUserWeekConflict']);
              } else if (err?.response?.data?.code === 'pschein_expired') {
                toastT.error(['pages.diensts.adminPage.assignUserWeekPscheinExpired']);
              } else if (err?.response?.data?.code === 'no_assignable_days') {
                toastT.error(['pages.diensts.adminPage.assignUserNoAssignableDays']);
              } else {
                toastT.error(['pages.diensts.adminPage.assignUserWeekErr']);
              }
            }
          }}
          weekStartISO={weekUserModal.weekStartISO}
        />
      )}
    </div>
  );
};

export default AdminPage;
