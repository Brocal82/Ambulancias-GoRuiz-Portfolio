// src/pages/AdminUserVacationsTab.tsx
import { useEffect, useState } from "react";
import type { IVacationRequest } from "../types/vacationRequest";
import { getVacationRequests, deleteVacationRequest } from "../api/vacation";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../utils/toast";
import { formatISOToDDMMYYYY } from "../utils/timeUtils";

interface Props {
  userId: string;
}

type VacationStatus = IVacationRequest["status"];

const AdminUserVacationsTab = ({ userId }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [vacations, setVacations] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!token || !userId) return;

    try {
      setLoading(true);
      const allVacations = await getVacationRequests(token);

      // Mantengo tu lógica: solo vacaciones aceptadas de ese usuario
      const acceptedVacations = allVacations.filter(
        (v: IVacationRequest) =>
          v.user._id === userId && v.status === "accepted",
      );

      setVacations(acceptedVacations);
      setError("");
    } catch {
      setError(t("pages.vacations.adminUserTab.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  const handleDeleteVacation = async (id: string) => {
    if (!token) return;

    if (!window.confirm(t("pages.vacations.adminUserTab.confirmDelete")))
      return;

    try {
      await deleteVacationRequest(token, id);
      setVacations((prev) => prev.filter((v) => v._id !== id));
      toastT.success(["toasts.vacations.deleted"]);
    } catch {
      toastT.error(["toasts.vacations.deleteError"]);
    }
  };

  const handleEditVacation = (id: string) => {
    toastT.info(["toasts.vacations.editPending", { id }]);
  };

  const badge = (status: VacationStatus) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

    if (status === "pending") {
      return (
        <span className={`${base} bg-amber-100 text-amber-800`}>
          {t("pages.vacations.status.pending", "Pendiente")}
        </span>
      );
    }

    if (status === "accepted") {
      return (
        <span className={`${base} bg-emerald-100 text-emerald-800`}>
          {t("pages.vacations.status.accepted", "Aceptada")}
        </span>
      );
    }

    // rejected u otros
    return (
      <span className={`${base} bg-rose-100 text-rose-800`}>
        {t("pages.vacations.status.rejected", "Rechazada")}
      </span>
    );
  };

  const calcDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    if (Number.isNaN(diff)) return "—";
    return Math.max(diff, 1);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow">
        {/* Cargando */}
        {loading && (
          <div className="p-4 text-sm text-slate-600 text-center">
            {t(
              "pages.vacations.adminUserTab.loading",
              "Cargando solicitudes de vacaciones...",
            )}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="p-4 text-sm text-red-600 text-center">{error}</div>
        )}

        {/* Vacío */}
        {!loading && !error && vacations.length === 0 && (
          <div className="p-4 text-sm text-slate-600 text-center">
            {t(
              "pages.vacations.adminUserTab.empty",
              "No hay vacaciones registradas para este trabajador",
            )}
          </div>
        )}

        {/* Tabla */}
        {!loading && !error && vacations.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[35%]" /> {/* Fechas */}
                <col className="w-[15%]" /> {/* Días */}
                <col className="w-[20%]" /> {/* Estado */}
                <col className="w-[30%]" /> {/* Acciones */}
              </colgroup>

              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-slate-600 border-b border-slate-200 text-center">
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                    {t("pages.vacations.adminUserTab.th.dates", "Fechas")}
                  </th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                    {t("pages.vacations.adminUserTab.th.days", "Días")}
                  </th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                    {t("pages.vacations.adminUserTab.th.status", "Estado")}
                  </th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                    {t("pages.vacations.adminUserTab.th.actions", "Acciones")}
                  </th>
                </tr>
              </thead>

              <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                {vacations.map((v) => {
                  const days = calcDays(v.startDate, v.endDate);

                  return (
                    <tr
                      key={v._id}
                      className="border-b border-slate-100 hover:bg-slate-50/70 text-center"
                    >
                      {/* Fechas */}
                      <td className="px-3 py-2 align-top">
                        <div className="text-slate-800 whitespace-nowrap">
                          {formatISOToDDMMYYYY(v.startDate)} —{" "}
                          {formatISOToDDMMYYYY(v.endDate)}
                        </div>
                      </td>

                      {/* Días */}
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        {days}
                      </td>

                      {/* Estado */}
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        {badge(v.status)}
                      </td>

                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap justify-center gap-2">
                          {/* ✏️ Editar */}
                          <button
                            type="button"
                            onClick={() => handleEditVacation(v._id)}
                            className="inline-flex items-center justify-center rounded-full border-slate-300 bg-white px-2.5 py-1.5 text-sm hover:bg-slate-50 text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
                            title={t(
                              "pages.vacations.adminUserTab.actions.edit",
                            )}
                          >
                            ✏️
                          </button>

                          {/* 🗑️ Eliminar */}
                          <button
                            type="button"
                            onClick={() => handleDeleteVacation(v._id)}
                            className="inline-flex items-center justify-center rounded-full bg-red-50 px-2.5 py-1.5 text-sm text-red-700 hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-100"
                            title={t(
                              "pages.vacations.adminUserTab.actions.delete",
                            )}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUserVacationsTab;
