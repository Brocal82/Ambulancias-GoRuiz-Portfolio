// src/components/vacation/AdminActionableVacationRequestsTable.tsx
import React from "react";
import type { TFunction } from "i18next";
import type { IVacationRequest } from "../domain/types";
import StatusBadge from "../../../components/common/StatusBadge";
import { APP_NAV_MATCH_TABLE_THEAD_STICKY } from "../../../components/ui/appTableHeader";
import { calcVacationDays } from "../utils/calcVacationDays";
import { getRequestRangeBerlin } from "../utils/getRequestRangeBerlin";
import { toBerlinDayKey } from "../../../utils/dates/dayKey";
import { vacationRequestTone } from "../utils/vacationRequestTone";


type Props = {
    t: TFunction;
    locale: string;

    rows: IVacationRequest[];

    // cancelar con textarea
    cancelingRequestId: string | null;
    cancelMessage: string;
    isSendingCancel: boolean;

    onStartCancelFlow: (id: string) => void;
    onCancelMessageChange: (value: string) => void;
    onConfirmCancel: (id: string) => void;
    onAbortCancelFlow: () => void;

    // acciones
    onAccept: (id: string) => void;
    onOpenAlternative: (req: IVacationRequest) => void;
    onCancelAlternative: (id: string) => void;
};

const AdminActionableVacationRequestsTable: React.FC<Props> = ({
    t,
    locale,
    rows,
    cancelingRequestId,
    cancelMessage,
    isSendingCancel,
    onStartCancelFlow,
    onCancelMessageChange,
    onConfirmCancel,
    onAbortCancelFlow,
    onAccept,
    onOpenAlternative,
    onCancelAlternative,
}) => {
    const [msgModal, setMsgModal] = React.useState<{
        open: boolean;
        title: string;
        message?: string;
    } | null>(null);
    if (rows.length === 0) return null;

    return (
        <>
            <div className="mt-4 overflow-x-auto">
                <table className="min-w-full table-fixed text-sm shadow-sm ring-1 ring-slate-200 rounded-xl overflow-hidden text-center">
                <colgroup>
                    <col className="w-[20%]" /> {/* Trabajador */}
                    <col className="w-[30%]" /> {/* Fechas */}
                    <col className="w-[8%]" /> {/* Días */}
                    <col className="w-[12%]" /> {/* Estado */}
                    <col className="w-[10%]" /> {/* Mensaje */}
                    <col className="w-[20%]" /> {/* Acciones */}
                </colgroup>

                <thead className={APP_NAV_MATCH_TABLE_THEAD_STICKY}>
                    <tr className="text-slate-200">
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
                            {t("pages.vacations.adminPage.table.message", "Mensaje")}
                        </th>
                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                            {t("pages.vacations.adminPage.table.actions")}
                        </th>
                    </tr>
                </thead>

                <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                    {rows.map((req) => {
                        const { start, end } = getRequestRangeBerlin(req);

                        const startKey = toBerlinDayKey(start.toISOString());
                        const endKey = toBerlinDayKey(end.toISOString());
                        const days = calcVacationDays(startKey, endKey);
                        const hasAlternative =
                            !!req.adminOptionStartDate && !!req.adminOptionEndDate;
                        const altDays = hasAlternative
                            ? calcVacationDays(
                                toBerlinDayKey(req.adminOptionStartDate as string) ??
                                (req.adminOptionStartDate as string),
                                toBerlinDayKey(req.adminOptionEndDate as string) ??
                                (req.adminOptionEndDate as string),
                            )
                            : 0;
                        const hasAdminMessage = !!req.adminNote?.trim();

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
                                        {start.toLocaleDateString(locale, { timeZone: "Europe/Berlin" })}
                                        {" — "}
                                        {end.toLocaleDateString(locale, { timeZone: "Europe/Berlin" })}
                                    </div>
                                    {hasAlternative ? (
                                        <div className="mt-1 text-[11px] text-sky-700 whitespace-nowrap font-medium">
                                            {new Date(req.adminOptionStartDate as string).toLocaleDateString(
                                                locale,
                                                { timeZone: "Europe/Berlin" },
                                            )}
                                            {" — "}
                                            {new Date(req.adminOptionEndDate as string).toLocaleDateString(
                                                locale,
                                                { timeZone: "Europe/Berlin" },
                                            )}
                                        </div>
                                    ) : (
                                        <></>
                                    )}
                                </td>

                                {/* Días */}
                                <td className="px-3 py-2 align-top whitespace-nowrap">
                                    <div>{days}</div>
                                    {hasAlternative ? (
                                        <div className="mt-1 text-[11px] text-sky-700 font-medium">
                                            {altDays}
                                        </div>
                                    ) : null}
                                </td>

                                {/* Estado */}
                                <td className="px-3 py-2 align-top whitespace-nowrap">
                                    {req.status === "option_sent" ? (
                                        <>
                                            <div className="h-[20px]" />
                                            <div className="mt-1 text-[11px] text-sky-700 font-medium">
                                                {t(`pages.vacations.adminPage.status.${req.status}`)}
                                            </div>
                                        </>
                                    ) : (
                                        <StatusBadge
                                            tone={vacationRequestTone(req.status)}
                                            label={t(`pages.vacations.adminPage.status.${req.status}`)}
                                        />
                                    )}
                                </td>

                                {/* Mensaje */}
                                <td className="px-3 py-2 align-top whitespace-nowrap">
                                    {hasAdminMessage ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setMsgModal({
                                                    open: true,
                                                    title: t(
                                                        "pages.vacations.adminPage.actions.viewMessage",
                                                        "Mensaje enviado",
                                                    ),
                                                    message: req.adminNote?.trim(),
                                                })
                                            }
                                            title={t(
                                                "pages.vacations.adminPage.actions.viewMessage",
                                                "Ver mensaje",
                                            )}
                                            aria-label={t(
                                                "pages.vacations.adminPage.actions.viewMessage",
                                                "Ver mensaje",
                                            )}
                                            className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 h-8 w-8 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                                        >
                                            📩
                                        </button>
                                    ) : (
                                        <span className="text-xs text-slate-400">—</span>
                                    )}
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
                                                onChange={(e) => onCancelMessageChange(e.target.value)}
                                            />
                                            <div className="flex space-x-2">
                                                <button
                                                    className="inline-flex items-center justify-center rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:ring-4 focus:ring-red-100"
                                                    disabled={isSendingCancel}
                                                    onClick={() => onConfirmCancel(req._id)}
                                                >
                                                    {isSendingCancel
                                                        ? t("pages.vacations.adminPage.actions.sending")
                                                        : t("pages.vacations.adminPage.actions.confirm")}
                                                </button>
                                                <button
                                                    className="inline-flex items-center justify-center rounded-full bg-gray-200 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-gray-300 focus:ring-4 focus:ring-gray-100"
                                                    disabled={isSendingCancel}
                                                    onClick={onAbortCancelFlow}
                                                >
                                                    {t("pages.vacations.adminPage.actions.cancel")}
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
                                                        onClick={() => onAccept(req._id)}
                                                        className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100 text-white"
                                                        title={t("pages.vacations.adminPage.actions.accept")}
                                                    >
                                                        ✅
                                                    </button>

                                                    {/* 🔄 OPCIÓN ALTERNATIVA */}
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenAlternative(req)}
                                                        className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm shadow-sm hover:bg-indigo-100 focus:outline-none focus:ring-4 focus:ring-indigo-100 text-white"
                                                        title={t(
                                                            "pages.vacations.adminPage.actions.altOption",
                                                        )}
                                                    >
                                                        🔄
                                                    </button>

                                                    {/* ❌ CANCELAR */}
                                                    <button
                                                        type="button"
                                                        onClick={() => onStartCancelFlow(req._id)}
                                                        className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100 text-white"
                                                        title={t("pages.vacations.adminPage.actions.cancel")}
                                                    >
                                                        ❌
                                                    </button>
                                                </>
                                            )}

                                            {req.status === "cancel_requested" && (
                                                <button
                                                    type="button"
                                                    onClick={() => onStartCancelFlow(req._id)}
                                                    className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100 text-white"
                                                    title={t("pages.vacations.adminPage.actions.confirmCancelRequest", "Confirmar cancelación solicitada")}
                                                >
                                                    🛑
                                                </button>
                                            )}

                                            {req.status === "option_sent" && (
                                                <button
                                                    type="button"
                                                    onClick={() => onCancelAlternative(req._id)}
                                                    className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm shadow-sm hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-100 text-white"
                                                    title={t(
                                                        "pages.vacations.adminPage.actions.cancelAlternative",
                                                        "Cancelar alternativa",
                                                    )}
                                                >
                                                    ↩️
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
                        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
                            <h3
                                id="admin-message-title"
                                className="text-sm font-semibold text-slate-900"
                            >
                                {msgModal.title}
                            </h3>

                            <button
                                onClick={() => setMsgModal(null)}
                                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                aria-label={t("pages.vacations.adminPage.actions.close", "Cerrar")}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="px-3 py-3 text-xs">
                            {msgModal.message ? (
                                <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 px-2.5 py-2 text-slate-700 whitespace-pre-wrap break-words">
                                    {msgModal.message}
                                </div>
                            ) : (
                                <div className="text-slate-400 italic">
                                    {t("pages.vacations.adminPage.actions.noMessage", "No hay mensaje adicional.")}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdminActionableVacationRequestsTable;



