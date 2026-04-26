// src/pages/AdminUserVacationsTab.tsx
import { useEffect, useState } from "react";
import type { IVacationRequest } from "../domain/types";
import {
  getVacationRequests,
  deleteVacationRequest,
  updateVacationRequest,
} from "../domain/api";
import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../../../utils/toast";
import { emitVacationRequestsUpdated } from "../utils/vacationEvents";
import DeleteIconButton from "../../../components/common/actions/DeleteIconButton";
import EditIconButton from "../../../components/common/actions/EditIconButton";
import SaveIconButton from "../../../components/common/actions/SaveIconButton";
import CancelButton from "../../../components/common/actions/CancelButton";
import { invalidateAvailabilityForRange } from "../utils/invalidateAvailabilityForRange";

import { formatISOToDDMMYYYY } from "../../../utils/timeUtils";
import { calcVacationDays } from "../utils/calcVacationDays";
import StatusBadge from "../../../components/common/StatusBadge";
import { vacationRequestTone } from "../utils/vacationRequestTone";
import { APP_NAV_MATCH_TABLE_THEAD_STICKY } from "../../../components/ui/appTableHeader";

interface Props {
  userId: string;
}


const AdminUserVacationsTab = ({ userId }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [vacations, setVacations] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    if (!token || !userId) return;

    try {
      setLoading(true);
      const allVacations = await getVacationRequests();

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

    const toDelete = vacations.find((v) => v._id === id);

    if (!window.confirm(t("pages.vacations.adminUserTab.confirmDelete"))) return;

    try {
      await deleteVacationRequest(id);

      // ✅ Actualiza UI local inmediata
      setVacations((prev) => prev.filter((v) => v._id !== id));

      // ✅ Avisar al “sistema global” (Worker/Admin hooks escuchan esto)
      emitVacationRequestsUpdated({
        type: "deleted",
        id,
        status: "cancelled",
      });

      // ✅ Invalidar caches de disponibilidad (colores/capacidad del grid)
      if (toDelete?.startDate && toDelete?.endDate) {
        invalidateAvailabilityForRange(toDelete.startDate, toDelete.endDate);
      }

      toastT.success(["toasts.vacations.deleted"]);
    } catch {
      toastT.error(["toasts.vacations.deleteError"]);
    }
  };


  const handleStartEditVacation = (v: IVacationRequest) => {
    setEditingId(v._id);
    setEditStartDate(v.startDate.slice(0, 10));
    setEditEndDate(v.endDate.slice(0, 10));
  };

  const handleCancelEditVacation = () => {
    setEditingId(null);
    setEditStartDate("");
    setEditEndDate("");
  };

  const handleSaveEditVacation = async (v: IVacationRequest) => {
    if (!token) return;
    if (!editStartDate || !editEndDate) {
      toastT.error(["toasts.vacations.admin.error"]);
      return;
    }
    if (new Date(editStartDate) > new Date(editEndDate)) {
      toastT.error(["toasts.vacations.admin.error"]);
      return;
    }

    setSavingEdit(true);
    try {
      await toastT.promise(
        updateVacationRequest(v._id, {
          startDate: editStartDate,
          endDate: editEndDate,
        }),
        {
          pending: ["toasts.vacations.admin.updating"],
          success: ["toasts.vacations.admin.updated"],
          error: ["toasts.vacations.admin.error"],
        },
      );

      setVacations((prev) =>
        prev
          .map((it) =>
            it._id === v._id
              ? { ...it, startDate: editStartDate, endDate: editEndDate }
              : it,
          )
          .sort(
            (a, b) =>
              new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
          ),
      );

      emitVacationRequestsUpdated({
        type: "updated",
        id: v._id,
        status: v.status,
      });

      invalidateAvailabilityForRange(v.startDate, v.endDate);
      invalidateAvailabilityForRange(editStartDate, editEndDate);
      handleCancelEditVacation();
    } finally {
      setSavingEdit(false);
    }
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

              <thead className={APP_NAV_MATCH_TABLE_THEAD_STICKY}>
                <tr className="text-center text-slate-200">
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
                  const days = calcVacationDays(v.startDate, v.endDate);
                  const isEditing = editingId === v._id;


                  return (
                    <tr
                      key={v._id}
                      className="border-b border-slate-100 hover:bg-slate-50/70 text-center"
                    >
                      {/* Fechas */}
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="date"
                              value={editStartDate}
                              onChange={(e) => setEditStartDate(e.target.value)}
                              title={t("pages.vacations.adminUserTab.th.dates", "Fechas")}
                              aria-label={t(
                                "pages.adminUsers.modals.columns.from",
                                "Desde",
                              )}
                              className="h-8 rounded-lg border border-slate-300 px-2 text-xs"
                              disabled={savingEdit}
                            />
                            <input
                              type="date"
                              value={editEndDate}
                              onChange={(e) => setEditEndDate(e.target.value)}
                              title={t("pages.vacations.adminUserTab.th.dates", "Fechas")}
                              aria-label={t(
                                "pages.adminUsers.modals.columns.to",
                                "Hasta",
                              )}
                              className="h-8 rounded-lg border border-slate-300 px-2 text-xs"
                              disabled={savingEdit}
                            />
                          </div>
                        ) : (
                          <div className="text-slate-800 whitespace-nowrap">
                            {formatISOToDDMMYYYY(v.startDate)} —{" "}
                            {formatISOToDDMMYYYY(v.endDate)}
                          </div>
                        )}
                      </td>

                      {/* Días */}
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        {isEditing
                          ? calcVacationDays(editStartDate, editEndDate)
                          : days}
                      </td>

                      {/* Estado */}
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <StatusBadge
                          tone={vacationRequestTone(v.status)}
                          label={t(`pages.vacations.adminPage.status.${v.status}`, v.status)}
                        />


                      </td>

                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap justify-center gap-2">
                          {isEditing ? (
                            <>
                              <SaveIconButton
                                type="button"
                                onClick={() => void handleSaveEditVacation(v)}
                                disabled={savingEdit}
                                title={t("common.save", "Guardar")}
                                className="!w-8 !h-8 !text-sm"
                              />
                              <CancelButton
                                onClick={handleCancelEditVacation}
                                disabled={savingEdit}
                                title={t("common.cancel", "Cancelar")}
                                className="!h-8"
                              >
                                {t("common.cancel", "Cancelar")}
                              </CancelButton>
                            </>
                          ) : (
                            <EditIconButton
                              onClick={() => handleStartEditVacation(v)}
                              title={t(
                                "pages.vacations.adminUserTab.actions.edit",
                              )}
                            />
                          )}

                          <DeleteIconButton
                            onClick={() => handleDeleteVacation(v._id)}
                            title={t(
                              "pages.vacations.adminUserTab.actions.delete",
                            )}
                          />
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



