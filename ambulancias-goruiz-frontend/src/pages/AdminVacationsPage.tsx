// frontend/src/pages/AdminVacationsPage.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import type { IVacationRequest } from "../types/vacationRequest";
import {
  getVacationRequests,
  updateVacationRequest,
  invalidateAvailabilityByRange,
  getVacationAvailability,
} from "../api/vacation";
import AlternativeDateModal from "../components/vacation/AlternativeDateModal";
import AdminVacationMonthGrid from "../components/vacation/AdminVacationMonthGrid";
import AdminVacationMonthModal from "../components/vacation/AdminVacationMonthModal";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../utils/toast";
import StatusBadge from "../components/common/StatusBadge";
import { calcVacationDays } from "../utils/vacation/calcVacationDays";
import { useVacationRequestsUpdated } from "../hooks/vacation/useVacationRequestsUpdated";
import { useVacationAvailabilityInvalidation } from "../hooks/vacation/useVacationAvailabilityInvalidation";
import { emitVacationRequestsUpdated } from "../utils/vacation/vacationEvents";



// Nombre del evento global para refrescar el badge del Dashboard
const ADMIN_VACATIONS_CHANGED_EVENT = "admin-vacations-changed";
const notifyVacationsChanged = () =>
  window.dispatchEvent(new Event(ADMIN_VACATIONS_CHANGED_EVENT));


const AdminVacationRequests = () => {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const [requests, setRequests] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ====== Estado del grid de meses (con año navegable) ======
  const [gridYear, setGridYear] = useState<number>(new Date().getFullYear());

  // ====== Estado del modal del mes (abrir con mes + año correctos) ======
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // 0..11
  const [selectedYear, setSelectedYear] = useState<number>(gridYear);

  // 🔄 Forzar refresco del grid cuando cambie la disponibilidad sin recargar
  const [gridRefreshTick, setGridRefreshTick] = useState(0);

  // Refresca caché del mes concreto y fuerza rerender del grid
  const forceRefreshMonth = useCallback(async (y: number, m1: number) => {
    try {
      await getVacationAvailability({ year: y, month: m1 }, { force: true });
    } catch { }
    setGridRefreshTick((n) => n + 1);
  }, []);

  // ====== Estado para AlternativeDateModal existente ======
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [modalInitialStartDate, setModalInitialStartDate] = useState<Date>(
    new Date(),
  );
  const [modalInitialEndDate, setModalInitialEndDate] = useState<Date>(
    new Date(),
  );
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(
    null,
  );
  const [cancelMessage, setCancelMessage] = useState("");
  const [isSendingCancel, setIsSendingCancel] = useState(false);

  const locale =
    i18n.language === "de"
      ? "de-DE"
      : i18n.language === "en"
        ? "en-US"
        : "es-ES";

  const fetchRequests = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const data = await getVacationRequests(token);
      setRequests(data);
      setError("");
    } catch {
      const msgKey = "toasts.vacations.admin.loadError";
      setError(t(msgKey));
      toastT.error([msgKey]);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  // 🔁 Debouncer para evitar refetch duplicado (eventos múltiples / renders)
  const refetchTimer = useRef<number | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    return () => {
      if (refetchTimer.current) {
        window.clearTimeout(refetchTimer.current);
        refetchTimer.current = null;
      }
    };
  }, []);



  useVacationRequestsUpdated(() => {
    fetchRequests();
  });




  useVacationAvailabilityInvalidation(({ year: y, month: m1 }) => {
    // Si quieres limitar a solo el año visible del grid:
    if (y !== gridYear) return;

    // Refresca la caché del mes invalidado y fuerza rerender del grid
    forceRefreshMonth(y, m1);
  });



  type VacationStatus = "pending" | "accepted" | "cancelled" | "option_sent";

  // Mostrar solo las solicitudes que requieren acción (pendientes u opción enviada)
  const actionableRequests = requests.filter(
    (r) => r.status === "pending" || r.status === "option_sent",
  );

  const handleUpdateStatus = async (id: string, status: VacationStatus) => {
    if (!token) return;

    // Para 'accepted' hacemos manejo manual para interceptar 409 (capacidad)
    if (status === "accepted") {
      try {
        await updateVacationRequest(token, id, { status });

        // 🟢 Invalidar disponibilidad en vivo (cambia capacidad)
        const req = requests.find((r) => r._id === id);
        if (req) {
          invalidateAvailabilityByRange(req.startDate, req.endDate);
        }

        // 🔔 Sync Worker y Dashboard
        emitVacationRequestsUpdated({
          type: "updated",
          id,
          status: "accepted",
        });


        notifyVacationsChanged();

        // ✅ Toast de éxito + refresco
        toastT.success(["toasts.vacations.admin.accepted"]);
        fetchRequests();
      } catch (e: any) {
        // Capacidad excedida (bloquear tercer aceptado)
        if (e?.status === 409 && e?.body?.code === "capacity_exceeded") {
          toastT.error(["toasts.vacations.admin.capacityExceeded"]);
          return;
        }
        // Otros errores
        toastT.error(["toasts.vacations.admin.error"]);
      }
      return;
    }

    // Para 'cancelled' y otros estados mantenemos toastT.promise
    const successMsg =
      status === "cancelled"
        ? (["toasts.vacations.admin.cancelled"] as const)
        : (["toasts.vacations.admin.updated"] as const);

    try {
      await toastT.promise(updateVacationRequest(token, id, { status }), {
        pending: ["toasts.vacations.admin.updating"],
        success: successMsg,
        error: ["toasts.vacations.admin.error"],
      });

      if (status === "cancelled") {
        const req = requests.find((r) => r._id === id);
        if (req) {
          invalidateAvailabilityByRange(req.startDate, req.endDate);
        }
        emitVacationRequestsUpdated({
          type: "updated",
          id,
          status: "cancelled",
        });
      }

      notifyVacationsChanged();
      fetchRequests();
    } catch {
      // el error ya se muestra por toast
    }
  };

  const handleSendAlternativeOption = async (
    id: string,
    adminOptionStartDate: string,
    adminOptionEndDate: string,
    adminNote: string,
  ) => {
    if (!token) return;

    try {
      await toastT.promise(
        updateVacationRequest(token, id, {
          status: "option_sent",
          adminOptionStartDate,
          adminOptionEndDate,
          adminNote,
        }),
        {
          pending: ["toasts.vacations.admin.sendingAlt"],
          success: ["toasts.vacations.admin.altSent"],
          error: ["toasts.vacations.admin.error"],
        },
      );

      // 🔔 Sync Worker: la propuesta alternativa cambia lo que ve el trabajador
      emitVacationRequestsUpdated({
        type: "updated",
        id,
        status: "option_sent",
      });

      // 🔔 Notificar al Dashboard
      notifyVacationsChanged();

      // 🔄 Refrescar lista del Admin
      fetchRequests();
    } catch {
      // el error ya se muestra por toast
    }
  };


  const handleConfirmCancel = async (id: string) => {
    if (!token) return;
    setIsSendingCancel(true);
    try {
      await toastT.promise(
        updateVacationRequest(token, id, {
          status: "cancelled",
          adminNote: cancelMessage,
        }),
        {
          pending: ["toasts.vacations.admin.cancelling"],
          success: ["toasts.vacations.admin.cancelled"],
          error: ["toasts.vacations.admin.error"],
        },
      );

      // 🟢 Invalidar disponibilidad en vivo tras cancelar (libera cupo)
      const req = requests.find((r) => r._id === id);
      if (req) {
        invalidateAvailabilityByRange(req.startDate, req.endDate);
      }

      // 🔔 Emitir sincronización a Worker
      emitVacationRequestsUpdated({
        type: "updated",
        id,
        status: "cancelled",
      });

      setCancelingRequestId(null);
      setCancelMessage("");

      // 🔔 Notificar al Dashboard
      notifyVacationsChanged();

      fetchRequests();
    } catch {
      // el error ya se muestra por toast
    } finally {
      setIsSendingCancel(false);
    }
  };

  const openAlternativeModal = async (
    reqId: string,
    startDate: string,
    endDate: string,
  ) => {
    setCurrentRequestId(reqId);

    const s = new Date(startDate);
    const e = new Date(endDate);
    setModalInitialStartDate(s);
    setModalInitialEndDate(e);

    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-4">
            {t("pages.vacations.adminPage.title")}
          </h2>

          {/* Bloque con borde (selector año + leyenda + grid) — h2 queda fuera */}
          <div className="rounded-xl ring-1 ring-slate-200 bg-white p-3 sm:p-4 mb-6">
            <AdminVacationMonthGrid
              key={`${gridYear}-${gridRefreshTick}`} // ✅ fuerza rerender cuando cambie la disponibilidad
              requests={requests}
              year={gridYear}
              onYearChange={(y) => setGridYear(y)}
              onMonthOpen={(monthIdx, y) => {
                setSelectedMonth(monthIdx);
                setSelectedYear(y);
              }}
            />
          </div>

          {/* Modal del mes (abre con mes + AÑO correctos) */}
          <AdminVacationMonthModal
            isOpen={selectedMonth !== null}
            monthIndex={selectedMonth}
            requests={requests}
            year={selectedYear}
            onClose={() => setSelectedMonth(null)}
            onActionDone={fetchRequests}
          />

          {/* Estados */}
          {loading && (
            <p className="mt-2 text-sm text-gray-500">
              {t("pages.vacations.adminPage.loading")}
            </p>
          )}

          {!loading && error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}

          {!loading && !error && actionableRequests.length === 0 && (
            <p className="mt-2 text-sm text-gray-600">
              {t("pages.vacations.adminPage.empty")}
            </p>
          )}

          {/* Tabla de solicitudes accionables */}
          {!loading && !error && actionableRequests.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full table-fixed text-sm shadow-sm ring-1 ring-slate-200 rounded-xl overflow-hidden text-center">
                <colgroup>
                  <col className="w-[22%]" /> {/* Trabajador */}
                  <col className="w-[26%]" /> {/* Fechas */}
                  <col className="w-[10%]" /> {/* Días */}
                  <col className="w-[17%]" /> {/* Estado */}
                  <col className="w-[25%]" /> {/* Acciones */}
                </colgroup>

                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-slate-600 border-b border-slate-200">
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                      {t("pages.vacations.adminPage.table.user")}
                    </th>
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                      {t("pages.vacations.adminPage.table.dates", "Fechas")}
                    </th>
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                      {t("pages.vacations.adminPage.table.days", "Días")}
                    </th>
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                      {t("pages.vacations.adminPage.table.status")}
                    </th>
                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                      {t("pages.vacations.adminPage.table.actions")}
                    </th>
                  </tr>
                </thead>

                <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                  {actionableRequests.map((req) => {
                    const days = calcVacationDays(req.startDate, req.endDate);


                    return (
                      <tr
                        key={req._id}
                        className="border-t border-slate-200 hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Trabajador */}
                        <td className="px-3 py-2 align-top">
                          {req.user ? (
                            <div className="text-slate-800 text-sm">
                              {req.user.lastName} {req.user.name}
                            </div>
                          ) : (
                            <span className="text-xs text-red-500">
                              {t(
                                "pages.vacations.adminPage.userMissing",
                                "Usuario no disponible",
                              )}
                            </span>
                          )}
                        </td>

                        {/* Fechas */}
                        <td className="px-3 py-2 align-top">
                          <div className="text-slate-800 whitespace-nowrap">
                            {new Date(req.startDate).toLocaleDateString(
                              locale,
                              { timeZone: "Europe/Berlin" },
                            )}
                            {" — "}
                            {new Date(req.endDate).toLocaleDateString(locale, {
                              timeZone: "Europe/Berlin",
                            })}
                          </div>
                        </td>

                        {/* Días */}
                        <td className="px-3 py-2 align-top whitespace-nowrap">
                          {days}
                        </td>

                        {/* Estado */}
                        <td className="px-3 py-2 align-top whitespace-nowrap">
                          <StatusBadge
                            context="vacation"
                            status={req.status}
                            label={t(
                              `pages.vacations.adminPage.status.${req.status}`,
                            )}
                          />
                        </td>

                        {/* Acciones */}
                        <td className="px-3 py-2 align-top">
                          {cancelingRequestId === req._id ? (
                            <div className="flex flex-col items-center space-y-2">
                              <textarea
                                className="border rounded-xl p-2 w-64 ring-1 ring-slate-200 text-sm"
                                placeholder={t(
                                  "pages.vacations.adminPage.actions.cancelMessagePlaceholder",
                                )}
                                value={cancelMessage}
                                onChange={(e) =>
                                  setCancelMessage(e.target.value)
                                }
                              />
                              <div className="flex space-x-2">
                                <button
                                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:ring-4 focus:ring-red-100"
                                  disabled={isSendingCancel}
                                  onClick={() => handleConfirmCancel(req._id)}
                                >
                                  {isSendingCancel
                                    ? t(
                                      "pages.vacations.adminPage.actions.sending",
                                    )
                                    : t(
                                      "pages.vacations.adminPage.actions.confirm",
                                    )}
                                </button>
                                <button
                                  className="inline-flex items-center justify-center rounded-full bg-gray-200 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-gray-300 focus:ring-4 focus:ring-gray-100"
                                  disabled={isSendingCancel}
                                  onClick={() => {
                                    setCancelingRequestId(null);
                                    setCancelMessage("");
                                  }}
                                >
                                  {t(
                                    "pages.vacations.adminPage.actions.cancel",
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap justify-center gap-2">
                              {req.status === "pending" && (
                                <>
                                  {/* ✅ ACEPTAR */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateStatus(req._id, "accepted")
                                    }
                                    className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100 text-white"
                                    title={t(
                                      "pages.vacations.adminPage.actions.accept",
                                    )}
                                  >
                                    ✅
                                  </button>

                                  {/* 🔄 OPCIÓN ALTERNATIVA */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openAlternativeModal(
                                        req._id,
                                        req.startDate,
                                        req.endDate,
                                      )
                                    }
                                    className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm shadow-sm hover:bg-indigo-100 focus:outline-none focus:ring-4 focus:ring-indigo-100 text-white"
                                    title={t(
                                      "pages.vacations.adminPage.actions.altOption",
                                    )}
                                  >
                                    🔄
                                  </button>

                                  {/* ❌ CANCELAR (abre textarea) */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCancelingRequestId(req._id)
                                    }
                                    className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100 text-white"
                                    title={t(
                                      "pages.vacations.adminPage.actions.cancel",
                                    )}
                                  >
                                    ❌
                                  </button>
                                </>
                              )}

                              {/* Para option_sent no mostramos acciones: está esperando respuesta del trabajador */}
                              {req.status === "option_sent" && null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* AlternativeDateModal */}
          <AlternativeDateModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            initialStartDate={modalInitialStartDate}
            initialEndDate={modalInitialEndDate}
            onSubmit={(altStart, altEnd, note) => {
              if (currentRequestId) {
                handleSendAlternativeOption(
                  currentRequestId,
                  altStart,
                  altEnd,
                  note,
                );
              }
              setIsModalOpen(false);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminVacationRequests;
