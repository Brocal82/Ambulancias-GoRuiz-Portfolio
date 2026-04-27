import { useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import type { Appointment } from "../domain/types";
import { useTranslation } from "react-i18next";

import {
    AdminProposeSlotsModal,
    AdminAppointmentMonthGrid,
    AdminMonthCalendar,
    AdminAppointmentDetail,
} from "../components";
import { useAdminAppointmentsSync } from "../hooks/useAdminAppointmentsSync";

import StatusBadge from "../../../components/common/StatusBadge";
import { toneForAppointmentStatus } from "../utils/appointmentTone";
import { APP_NAV_MATCH_TABLE_THEAD_STICKY } from "../../../components/ui/appTableHeader";
import ProposeSlotsIconButton from "../../../components/common/actions/ProposeSlotsIconButton";
import ViewIconButton from "../../../components/common/actions/ViewIconButton";


// Utils locales
const formatRange = (startISO?: string, endISO?: string) => {
    if (!startISO || !endISO) return "";
    const start = new Date(startISO);
    const end = new Date(endISO);
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = `${pad(start.getDate())}.${pad(start.getMonth() + 1)}.${start.getFullYear()}`;
    const hs = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    const he = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
    return `${d} ${hs}–${he}`;
};

export default function AdminAppointmentsPage() {
    const { token } = useAuth();
    const { t } = useTranslation("common");

    const year = useMemo(() => new Date().getFullYear(), []);
    const currentMonthIndex = useMemo(() => new Date().getMonth(), []);

    const {
        pending,
        confirmedYear,
        loadingPending,
        loadingConfirmed,
        refetch,
        upsertPending,
    } = useAdminAppointmentsSync({ token, year });

    const [openPropose, setOpenPropose] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailItem, setDetailItem] = useState<Appointment | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

    const statusLabel = (s: Appointment["status"]) =>
        t(`pages.appointments.statusLabel.${s}`);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
                <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
                    {/* Header */}
                    <div className="mb-4 flex items-center justify-between">
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                            {t("pages.appointments.admin.title")}
                        </h1>
                        <button
                            onClick={() => void refetch()}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
                        >
                            {t("pages.appointments.actions.refresh")}
                        </button>
                    </div>

                    {/* 1) Grid de 12 meses */}
                    <section className="mb-6">
                        {loadingConfirmed ? (
                            <p className="text-sm text-gray-600">
                                {t("pages.appointments.status.loadingYear")}
                            </p>
                        ) : (
                            <AdminAppointmentMonthGrid
                                items={confirmedYear}
                                year={year}
                                selectedMonth={selectedMonth}
                                onMonthClick={(mi) => {
                                    setSelectedMonth((prev) => (prev === mi ? null : mi));
                                }}
                                highlightCurrentMonth
                                currentMonthIndex={currentMonthIndex}
                            />

                        )}
                    </section>

                    {/* 2) Calendario del mes seleccionado */}
                    <section className="mb-8">
                        {loadingConfirmed ? (
                            <p className="text-sm text-gray-600">
                                {t("pages.appointments.status.loadingMonth")}
                            </p>
                        ) : selectedMonth === null ? null : (
                            <AdminMonthCalendar
                                items={confirmedYear}
                                year={year}
                                monthIndex={selectedMonth}
                                onAppointmentClick={(a) => {
                                    setDetailItem(a);
                                    setDetailOpen(true);
                                }}
                            />
                        )}
                    </section>

                    {/* 3) Bloque de Pendientes (pending + proposed) */}
                    <section className="mt-8 pt-6 border-t border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-900 mb-3">
                            {t("pages.appointments.pending.title")}
                        </h2>

                        {loadingPending ? (
                            <p className="text-sm text-gray-600">
                                {t("pages.appointments.status.loading")}
                            </p>
                        ) : pending.length === 0 ? (
                            <p className="text-sm text-gray-600">
                                {t("pages.appointments.pending.empty")}
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="min-w-full table-fixed text-sm">
                                    <colgroup>
                                        <col className="w-[20%]" />
                                        <col className="w-[20%]" />
                                        <col className="w-[12%]" />
                                        <col className="w-[16%]" />
                                        <col className="w-[14%]" />
                                        <col className="w-[18%]" />
                                    </colgroup>
                                    <thead className={APP_NAV_MATCH_TABLE_THEAD_STICKY}>
                                        <tr className="text-center text-slate-200">
                                            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                                {t("pages.appointments.labels.worker")}
                                            </th>
                                            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                                {t("pages.appointments.labels.reason")}
                                            </th>
                                            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                                Detalles
                                            </th>
                                            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                                {t("pages.appointments.labels.sentAt")}
                                            </th>
                                            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                                {t("pages.appointments.labels.status")}
                                            </th>
                                            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                                {t("pages.appointments.labels.actions")}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                                        {pending.map((a) => {
                                            const worker =
                                                typeof a.workerId === "object" ? a.workerId : null;
                                            const hasMessage =
                                                !!a.details?.trim() ||
                                                (a.status === "proposed" &&
                                                    (a.proposedSlots?.length ?? 0) > 0);
                                            return (
                                                <tr
                                                    key={a._id}
                                                    className="border-b border-slate-100 hover:bg-slate-50/70 text-center"
                                                >
                                                    <td className="px-3 py-2 align-top text-slate-800 break-words">
                                                        {worker
                                                            ? `${worker.lastName}, ${worker.name}`
                                                            : `ID: ${typeof a.workerId === "string" ? a.workerId : ""}`}
                                                    </td>
                                                    <td className="px-3 py-2 align-top text-slate-800 break-words">
                                                        {a.reason}
                                                    </td>
                                                    <td className="px-3 py-2 align-top whitespace-nowrap">
                                                        {hasMessage ? (
                                                            <ViewIconButton
                                                                onClick={() => {
                                                                    setDetailItem(a);
                                                                    setDetailOpen(true);
                                                                }}
                                                                title={t("pages.appointments.messageModal.open")}
                                                            />
                                                        ) : (
                                                            <span className="text-xs text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 align-top whitespace-nowrap text-slate-700">
                                                        {new Date(a.createdAt).toLocaleString("de-DE")}
                                                    </td>
                                                    <td className="px-3 py-2 align-top whitespace-nowrap">
                                                        <StatusBadge
                                                            label={statusLabel(a.status)}
                                                            tone={toneForAppointmentStatus(a.status)}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 align-top">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {a.status === "pending" ? (
                                                                <ProposeSlotsIconButton
                                                                    onClick={() => {
                                                                        setSelectedId(a._id);
                                                                        setOpenPropose(true);
                                                                    }}
                                                                    title={t("pages.appointments.actions.proposeSlots")}
                                                                />
                                                            ) : (
                                                                <span className="text-xs text-slate-400">—</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    {/* Modal: Proponer horarios */}
                    <AdminProposeSlotsModal
                        isOpen={openPropose}
                        appointmentId={selectedId || ""}
                        onClose={() => {
                            setOpenPropose(false);
                            setSelectedId(null);
                        }}
                        onSuccess={async (updated) => {
                            upsertPending(updated);
                            await refetch();
                        }}
                        defaultDurationMinutes={30}
                    />

                    {/* Modal: Detalle de cita */}
                    <AdminAppointmentDetail
                        isOpen={detailOpen}
                        onClose={() => setDetailOpen(false)}
                        item={detailItem}
                        onChanged={async () => {
                            await refetch();
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
