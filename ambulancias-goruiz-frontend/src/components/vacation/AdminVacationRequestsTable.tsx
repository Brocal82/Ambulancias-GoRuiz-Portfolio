// src/components/vacation/AdminVacationRequestsTable.tsx
import React from "react";
import type { TFunction } from "i18next";
import type { IVacationRequest } from "../../types/vacationRequest";
import type { VacationStatus } from "../../types/vacation";
import { calcVacationDays } from "../../utils/vacation/calcVacationDays";

type Props = {
    t: TFunction;

    rows: IVacationRequest[];

    highlightRequestId: string | null;
    onToggleHighlight: (req: IVacationRequest) => void;

    fmtDate: (iso: string) => string;
    statusBadge: (status: VacationStatus) => React.ReactNode;

    // acciones
    onAccept: (id: string) => void;
    onOpenAlternative: (req: IVacationRequest) => void;
    onDelete: (id: string) => void;

    // flujo cancelar con textarea
    cancelingRequestId: string | null;
    cancelMessage: string;
    isSendingCancel: boolean;
    onStartCancelFlow: (id: string) => void;
    onCancelMessageChange: (value: string) => void;
    onConfirmCancel: (id: string) => void;
    onAbortCancelFlow: () => void;
};

const AdminVacationRequestsTable: React.FC<Props> = ({
    t,
    rows,
    highlightRequestId,
    onToggleHighlight,
    fmtDate,
    statusBadge,
    onAccept,
    onOpenAlternative,
    onDelete,
    cancelingRequestId,
    cancelMessage,
    isSendingCancel,
    onStartCancelFlow,
    onCancelMessageChange,
    onConfirmCancel,
    onAbortCancelFlow,
}) => {
    if (rows.length === 0) {
        return (
            <p className="text-center text-xs text-slate-500">
                {t("pages.vacations.monthModal.empty")}
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-xs shadow-sm ring-1 ring-slate-200 rounded-xl overflow-hidden text-center">
                <colgroup>
                    <col className="w-[24%]" /> {/* Trabajador */}
                    <col className="w-[30%]" /> {/* Fechas */}
                    <col className="w-[10%]" /> {/* Días */}
                    <col className="w-[16%]" /> {/* Estado */}
                    <col className="w-[20%]" /> {/* Acciones */}
                </colgroup>

                <thead className="bg-slate-50">
                    <tr className="text-slate-600 border-b border-slate-200 text-center">
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide">
                            {t("pages.vacations.adminPage.table.user", "Trabajador")}
                        </th>
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide">
                            {t("pages.vacations.adminPage.table.dates", "Fechas")}
                        </th>
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide">
                            {t("pages.vacations.adminPage.table.days", "Días")}
                        </th>
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide">
                            {t("pages.vacations.adminPage.table.status", "Estado")}
                        </th>
                        <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide">
                            {t("pages.vacations.adminPage.table.actions", "Acciones")}
                        </th>
                    </tr>
                </thead>

                <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                    {rows.map((req) => {
                        const isActive = highlightRequestId === req._id;
                        const days = calcVacationDays(req.startDate, req.endDate);

                        const hasProposal =
                            !!req.adminOptionStartDate && !!req.adminOptionEndDate;

                        return (
                            <tr
                                key={req._id}
                                onClick={(e) => {
                                    const target = e.target as HTMLElement;
                                    if (target.closest("button, textarea")) return;
                                    onToggleHighlight(req);
                                }}
                                className={[
                                    "border-t border-slate-200 cursor-pointer transition-colors",
                                    isActive
                                        ? "!bg-amber-100 hover:!bg-amber-100 ring-1 ring-amber-300"
                                        : "hover:bg-slate-50",
                                ].join(" ")}
                            >
                                {/* Trabajador */}
                                <td className="px-2 py-2 text-center align-top">
                                    <div className="text-[11px] font-medium text-slate-900 truncate">
                                        {req.user
                                            ? `${req.user.lastName}, ${req.user.name}`
                                            : t(
                                                "pages.vacations.adminPage.userMissing",
                                                "Usuario no disponible",
                                            )}
                                    </div>

                                    {req.adminNote && (
                                        <div className="mt-0.5 text-[10px] text-slate-600 line-clamp-2">
                                            <span className="font-semibold">
                                                {t(
                                                    "pages.vacations.adminPage.badges.note",
                                                    "Nota:",
                                                )}{" "}
                                            </span>
                                            {req.adminNote}
                                        </div>
                                    )}
                                </td>

                                {/* Fechas */}
                                <td className="px-2 py-2 text-center align-top">
                                    <div className="text-[11px] text-slate-800 whitespace-nowrap">
                                        {fmtDate(req.startDate)} — {fmtDate(req.endDate)}
                                    </div>

                                    {hasProposal && (
                                        <div
                                            className="mt-1 inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-medium text-sky-700 shadow-sm"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <span className="text-sky-600">📅</span>
                                            <span>
                                                {t(
                                                    "pages.vacations.adminPage.badges.proposal",
                                                    "Propuesta:",
                                                )}{" "}
                                                {fmtDate(req.adminOptionStartDate!)} —{" "}
                                                {fmtDate(req.adminOptionEndDate!)}
                                            </span>
                                        </div>
                                    )}
                                </td>

                                {/* Días */}
                                <td className="px-2 py-2 text-center align-top whitespace-nowrap">
                                    {days}
                                </td>

                                {/* Estado */}
                                <td className="px-2 py-2 text-center align-top whitespace-nowrap">
                                    {statusBadge(req.status)}
                                </td>

                                {/* Acciones */}
                                <td className="px-2 py-2 text-center align-top whitespace-nowrap">
                                    {cancelingRequestId === req._id ? (
                                        <div
                                            className="w-full rounded-lg ring-1 ring-slate-200 p-1.5 bg-white"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <textarea
                                                className="w-full resize-none rounded-lg border border-slate-300 ring-1 ring-slate-200 p-1.5 text-[10px] leading-snug focus:outline-none focus:ring-2 focus:ring-rose-100"
                                                placeholder={t(
                                                    "pages.vacations.adminPage.actions.cancelMessagePlaceholder",
                                                )}
                                                rows={3}
                                                value={cancelMessage}
                                                onChange={(e) => onCancelMessageChange(e.target.value)}
                                            />
                                            <div className="mt-1 flex gap-1.5 justify-end">
                                                <button
                                                    className="rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:opacity-50"
                                                    disabled={isSendingCancel}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onConfirmCancel(req._id);
                                                    }}
                                                >
                                                    {isSendingCancel
                                                        ? t("pages.vacations.adminPage.actions.sending")
                                                        : t(
                                                            "pages.vacations.adminPage.actions.confirmRejection",
                                                            "Confirmar",
                                                        )}
                                                </button>

                                                <button
                                                    className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 disabled:opacity-50"
                                                    disabled={isSendingCancel}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAbortCancelFlow();
                                                    }}
                                                >
                                                    {t(
                                                        "pages.vacations.adminPage.actions.cancel",
                                                        "Cancelar",
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap justify-center gap-1.5">
                                            {req.status === "pending" && (
                                                <>
                                                    {/* ✅ ACEPTAR */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onAccept(req._id);
                                                        }}
                                                        className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                                                        title={t(
                                                            "pages.vacations.adminPage.actions.accept",
                                                            "Aceptar",
                                                        )}
                                                    >
                                                        ✅
                                                    </button>

                                                    {/* 🔄 ALTERNATIVA */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onOpenAlternative(req);
                                                        }}
                                                        className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                        title={t(
                                                            "pages.vacations.adminPage.actions.altOption",
                                                            "Proponer alternativa",
                                                        )}
                                                    >
                                                        🔄
                                                    </button>

                                                    {/* ❌ CANCELAR */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onStartCancelFlow(req._id);
                                                        }}
                                                        className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-100"
                                                        title={t(
                                                            "pages.vacations.adminPage.actions.cancel",
                                                            "Rechazar / cancelar",
                                                        )}
                                                    >
                                                        ❌
                                                    </button>
                                                </>
                                            )}

                                            {(req.status === "accepted" || req.status === "cancelled") && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(req._id);
                                                    }}
                                                    aria-label={t(
                                                        "pages.vacations.adminPage.actions.delete",
                                                        "Eliminar",
                                                    )}
                                                    title={t(
                                                        "pages.vacations.adminPage.actions.delete",
                                                        "Eliminar",
                                                    )}
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full
                          bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 active:scale-95 transition
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400
                          focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default AdminVacationRequestsTable;
