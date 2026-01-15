import React, { useEffect, useMemo, useRef, useState } from "react";
import type { IVacationRequest } from "../../types/vacationRequest";
import type { VacationStatus } from "../../types/vacation";
import { useTranslation } from "react-i18next";
import { formatISOToDDMMYYYY } from "../../utils/timeUtils";
import { calcVacationDays } from "../../utils/vacation/calcVacationDays";
import { getRequestRangeBerlin } from "../../utils/vacation/getRequestRangeBerlin";
import { toBerlinDayKey } from "../../utils/dates/dayKey";


type Props = {
  requests: IVacationRequest[];
  onRespondAlternative: (id: string, accept: boolean) => void;
  onCancelRequest?: (id: string) => void;
};

type AdminMessageModalState = {
  open: boolean;
  title: string;
  message?: string;
  requestedStart: string;
  requestedEnd: string;
  proposedStart?: string;
  proposedEnd?: string;
};

const UserVacationList: React.FC<Props> = ({
  requests,
  onRespondAlternative,
  onCancelRequest,
}) => {
  const { t } = useTranslation();

  // ✅ Modal “pro” (sin alerts)
  const [msgModal, setMsgModal] = useState<AdminMessageModalState | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!msgModal?.open) return;

    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMsgModal(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [msgModal?.open]);

  const statusBadge = (status: VacationStatus) => {
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

    if (status === "option_sent") {
      return (
        <span className={`${base} bg-sky-100 text-sky-800`}>
          {t("pages.vacations.status.option_sent", "alternativa")}
        </span>
      );
    }

    return (
      <span className={`${base} bg-rose-100 text-rose-800`}>
        {t("pages.vacations.status.cancelled", "Cancelada")}
      </span>
    );
  };

  const openAdminMessage = (req: IVacationRequest) => {
    const adminNote = req.adminNote?.trim();
    const proposedStart = req.adminOptionStartDate;
    const proposedEnd = req.adminOptionEndDate;

    const { start, end } = getRequestRangeBerlin(req);



    const hasProposal =
      req.status === "option_sent" && !!proposedStart && !!proposedEnd;

    const title =
      req.status === "cancelled"
        ? t(
          "pages.vacations.workerList.adminMessageTitle.cancelled",
          "Mensaje del administrador (cancelación)",
        )
        : hasProposal
          ? t(
            "pages.vacations.workerList.adminMessageTitle.option",
            "Propuesta del administrador",
          )
          : t(
            "pages.vacations.workerList.adminMessageTitle.default",
            "Mensaje del administrador",
          );

    setMsgModal({
      open: true,
      title,
      message: adminNote || undefined,
      requestedStart: start.toISOString(),
      requestedEnd: end.toISOString(),

      proposedStart: hasProposal ? proposedStart : undefined,
      proposedEnd: hasProposal ? proposedEnd : undefined,
    });
  };

  const safeRequests = useMemo(() => requests ?? [], [requests]);

  if (!safeRequests || safeRequests.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 shadow-sm">
        {t("pages.vacations.list.empty")}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[36%]" /> {/* Fechas */}
            <col className="w-[12%]" /> {/* Días */}
            <col className="w-[22%]" /> {/* Estado */}
            <col className="w-[15%]" /> {/* Mensaje */}
            <col className="w-[15%]" /> {/* Acciones */}
          </colgroup>

          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr className="text-slate-600 border-b border-slate-200 text-center">
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                {t("pages.vacations.workerList.th.dates", "Fechas")}
              </th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                {t("pages.vacations.workerList.th.days", "Días")}
              </th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                {t("pages.vacations.workerList.th.status", "Estado")}
              </th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                {t("pages.vacations.workerList.th.message", "Mensaje")}
              </th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                {t("pages.vacations.workerList.th.actions", "Acciones")}
              </th>
            </tr>
          </thead>

          <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
            {safeRequests.map((req) => {
              // ✅ Fuente de verdad: rango Berlin (día calendario)
              const { start, end } = getRequestRangeBerlin(req);

              // ✅ Días usando dayKey Berlin (evita depender de ISO directo en UI)
              const startKey = toBerlinDayKey(start.toISOString());
              const endKey = toBerlinDayKey(end.toISOString());
              const days = calcVacationDays(startKey, endKey);



              const proposedStart = req.adminOptionStartDate;
              const proposedEnd = req.adminOptionEndDate;


              const hasAlternative =
                req.status === "option_sent" &&
                !!proposedStart &&
                !!proposedEnd;

              const adminNote = req.adminNote?.trim();

              const hasAdminMessage = !!adminNote && adminNote.length > 0;

              // ✅ Sobre si hay propuesta o mensaje
              const showEnvelope = hasAlternative || hasAdminMessage;

              return (
                <tr
                  key={req._id}
                  className="border-b border-slate-100 hover:bg-slate-50/70 text-center"
                >
                  {/* Fechas */}
                  <td className="px-3 py-2 align-top">
                    <div className="text-slate-800 whitespace-nowrap">
                      {formatISOToDDMMYYYY(start.toISOString())} —{" "}
                      {formatISOToDDMMYYYY(end.toISOString())}

                    </div>

                    {/* ✅ Eliminado: badge azul debajo de las fechas */}
                  </td>

                  {/* Días */}
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {days}
                  </td>

                  {/* Estado */}
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {statusBadge(req.status)}
                  </td>

                  {/* Mensaje */}
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {showEnvelope ? (
                      <button
                        type="button"
                        onClick={() => openAdminMessage(req)}
                        title={t(
                          "pages.vacations.workerList.adminMessage",
                          "Ver mensaje / propuesta",
                        )}
                        aria-label={t(
                          "pages.vacations.workerList.adminMessage",
                          "Ver mensaje / propuesta",
                        )}
                        className="inline-flex items-center justify-center rounded-full
                          bg-slate-100 text-slate-700 hover:bg-slate-200
                          h-8 w-8 text-sm shadow-sm
                          focus:outline-none focus:ring-2 focus:ring-slate-300"
                      >
                        📩
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="px-3 py-2 align-top">
                    {hasAlternative ? (
                      <div className="flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRespondAlternative(req._id, true)}
                          className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                          title={t(
                            "pages.vacations.workerList.actions.acceptAlt",
                            "Aceptar alternativa",
                          )}
                        >
                          ✅
                        </button>

                        <button
                          type="button"
                          onClick={() => onRespondAlternative(req._id, false)}
                          className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100"
                          title={t(
                            "pages.vacations.workerList.actions.rejectAlt",
                            "Rechazar alternativa",
                          )}
                        >
                          ❌
                        </button>
                      </div>
                    ) : (req.status === "pending" || req.status === "option_sent") &&
                      onCancelRequest ? (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => onCancelRequest(req._id)}
                          className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100"
                          title={t(
                            "pages.vacations.workerList.actions.cancel",
                            "Cancelar solicitud",
                          )}
                        >
                          ❌
                        </button>

                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal compacto de mensaje del admin */}
      {msgModal?.open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMsgModal(null)}
          />

          <div
            className="relative z-10 w-full max-w-sm rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-message-title"
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
              <h3
                id="admin-message-title"
                className="text-sm font-semibold text-slate-900"
              >
                {msgModal.title}
              </h3>

              <button
                ref={closeBtnRef}
                onClick={() => setMsgModal(null)}
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full
            text-slate-600 hover:bg-slate-100
            focus:outline-none focus:ring-2 focus:ring-slate-300"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-3 py-3 space-y-3 text-xs">
              {/* Fechas */}
              <div className="flex flex-wrap gap-2">
                {/* Solicitadas */}
                <span
                  className="inline-flex items-center rounded-full
              bg-amber-100 text-amber-800
              px-2.5 py-1 font-medium"
                  title="Fechas solicitadas"
                >
                  🟡 {formatISOToDDMMYYYY(msgModal.requestedStart)} —{" "}
                  {formatISOToDDMMYYYY(msgModal.requestedEnd)}
                </span>

                {/* Propuestas */}
                {msgModal.proposedStart && msgModal.proposedEnd && (
                  <span
                    className="inline-flex items-center rounded-full
                bg-sky-100 text-sky-800
                px-2.5 py-1 font-medium"
                    title="Fechas propuestas"
                  >
                    🔵 {formatISOToDDMMYYYY(msgModal.proposedStart)} —{" "}
                    {formatISOToDDMMYYYY(msgModal.proposedEnd)}
                  </span>
                )}
              </div>

              {/* Mensaje */}
              {msgModal.message ? (
                <div
                  className="rounded-lg bg-slate-50 ring-1 ring-slate-200
              px-2.5 py-2 text-slate-700 whitespace-pre-wrap break-words"
                >
                  {msgModal.message}
                </div>
              ) : (
                <div className="text-slate-400 italic">
                  No hay mensaje adicional.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-3 py-2 flex justify-end">
              <button
                onClick={() => setMsgModal(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium
            text-slate-700 ring-1 ring-slate-200
            hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserVacationList;
