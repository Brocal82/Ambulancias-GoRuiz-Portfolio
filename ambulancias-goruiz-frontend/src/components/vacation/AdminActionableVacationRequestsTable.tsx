// src/components/vacation/AdminActionableVacationRequestsTable.tsx
import React from "react";
import type { TFunction } from "i18next";
import type { IVacationRequest } from "../../types/vacationRequest";
import StatusBadge from "../common/StatusBadge";
import { calcVacationDays } from "../../utils/vacation/calcVacationDays";

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
}) => {
    if (rows.length === 0) return null;

    return (
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
                    {rows.map((req) => {
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
                                        {new Date(req.startDate).toLocaleDateString(locale, {
                                            timeZone: "Europe/Berlin",
                                        })}
                                        {" — "}
                                        {new Date(req.endDate).toLocaleDateString(locale, {
                                            timeZone: "Europe/Berlin",
                                        })}
                                    </div>
                                </td>

                                {/* Días */}
                                <td className="px-3 py-2 align-top whitespace-nowrap">{days}</td>

                                {/* Estado */}
                                <td className="px-3 py-2 align-top whitespace-nowrap">
                                    <StatusBadge
                                        context="vacation"
                                        status={req.status}
                                        label={t(`pages.vacations.adminPage.status.${req.status}`)}
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

                                            {/* option_sent: no actions */}
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
    );
};

export default AdminActionableVacationRequestsTable;
