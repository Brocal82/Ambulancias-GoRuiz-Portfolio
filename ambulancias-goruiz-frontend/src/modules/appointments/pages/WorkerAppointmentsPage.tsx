// frontend/src/modules/appointments/pages/WorkerAppointmentsPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";

import {
    getMyAppointments,
    deleteMyAppointment as apiDeleteMyAppointment,
    requestCancellation as apiRequestCancellation,
} from "../domain";

import {
    RequestAppointmentModal,
    ChooseSlotModal,
} from "../components";
import { emitAppointmentsChanged } from "../utils/appointmentEvents";
import { useAppointmentsChanged } from "../hooks/useAppointmentsChanged";

import type { Appointment } from "../domain/types";
import { toastT, getApiErrorMessage } from "../../../utils/toast";
import { APP_TZ } from "../../../config/app";
import { useTranslation } from "react-i18next";
import StatusBadge from "../../../components/common/StatusBadge";
import { toneForAppointmentStatus } from "../utils/appointmentTone";
import CreateIconButton from "../../../components/common/actions/CreateIconButton";
import StopIconButton from "../../../components/common/actions/StopIconButton";
import { APP_NAV_MATCH_TABLE_THEAD_STICKY } from "../../../components/ui/appTableHeader";
import ViewIconButton from "../../../components/common/actions/ViewIconButton";
import ProposeSlotsIconButton from "../../../components/common/actions/ProposeSlotsIconButton";

/** Util: formato corto fecha/hora en la TZ de la app */
function fmt(dtIso?: string): string {
    if (!dtIso) return "—";
    return new Date(dtIso).toLocaleString("de-DE", { timeZone: APP_TZ });
}

/** Helpers de ordenación */
function earliestProposedStart(a: Appointment): number | null {
    if (!a.proposedSlots || a.proposedSlots.length === 0) return null;
    const mins = a.proposedSlots
        .map((s) => new Date(s.start).getTime())
        .filter((t) => !Number.isNaN(t));
    if (mins.length === 0) return null;
    return Math.min(...mins);
}
function createdAtMs(a: Appointment): number {
    const t = new Date(a.createdAt).getTime();
    return Number.isNaN(t) ? 0 : t;
}
function selectedStartMs(a: Appointment): number {
    const t = a.selectedSlot?.start
        ? new Date(a.selectedSlot.start).getTime()
        : 0;
    return Number.isNaN(t) ? 0 : t;
}

export default function WorkerAppointmentsPage() {
    const { token } = useAuth();
    const { t } = useTranslation("common");

    const [items, setItems] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal "Pedir cita"
    const [openRequest, setOpenRequest] = useState(false);

    // Modal "Elegir hora"
    const [openChoose, setOpenChoose] = useState(false);
    const [chooseId, setChooseId] = useState<string>("");
    const [chooseSlots, setChooseSlots] = useState<
        { start: string; end: string }[]
    >([]);
    const [openMessageModal, setOpenMessageModal] = useState(false);
    const [messageAppointment, setMessageAppointment] = useState<Appointment | null>(null);

    // Modal "Solicitar cancelación"
    const [cancelModal, setCancelModal] = useState<{
        open: boolean;
        appointmentId: string;
        message: string;
        loading: boolean;
    }>({ open: false, appointmentId: "", message: "", loading: false });

    const openAppointmentMessage = (a: Appointment) => {
        setMessageAppointment(a);
        setOpenMessageModal(true);
    };

    const refresh = async () => {
        try {
            const data = await getMyAppointments(token!);
            setItems(data);
        } catch (e: unknown) {
            toastT.error(getApiErrorMessage(e, ["toasts.appointments.loadError"]));
        }
    };
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const data = await getMyAppointments(token!);
                if (mounted) setItems(data);
            } catch (e: unknown) {
                toastT.error(getApiErrorMessage(e, ["toasts.appointments.loadError"]));
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [token]);

    // Sincronización reactiva cross-tab (CustomEvent + BroadcastChannel + storage)
    useAppointmentsChanged(() => void refreshRef.current?.());

    // Traducción de estado
    const statusLabel = (s: Appointment["status"]) =>
        t(`pages.appointments.statusLabel.${s}`);

    // Solicitudes (pending/proposed) — ORDENADAS:
    // - Si tiene opciones: por la hora propuesta más temprana (ASC)
    // - Si no tiene opciones: por fecha de creación (DESC)
    const recent = useMemo(() => {
        const arr = items.filter(
            (a) => a.status === "pending" || a.status === "proposed" || a.status === "cancellation_requested",
        );

        return arr.slice().sort((a, b) => {
            const ea = earliestProposedStart(a);
            const eb = earliestProposedStart(b);

            // Ambos con opciones: más próximo primero
            if (ea !== null && eb !== null) return ea - eb;

            // Solo A con opciones -> A antes
            if (ea !== null && eb === null) return -1;
            // Solo B con opciones -> B antes
            if (ea === null && eb !== null) return 1;

            // Ninguno con opciones -> por createdAt (DESC, lo más reciente primero)
            return createdAtMs(b) - createdAtMs(a);
        });
    }, [items]);

    // Otras citas: confirmed/rescheduled/cancelled
    // ORDENADAS por selectedSlot.start ASC (más antiguas arriba, más nuevas abajo)
    const others = useMemo(() => {
        return items
            .filter(
                (a) =>
                    a.status === "confirmed" ||
                    a.status === "rescheduled" ||
                    a.status === "cancelled",
            )
            .sort((a, b) => selectedStartMs(a) - selectedStartMs(b));
    }, [items]);

    const handleRequestCancellation = async () => {
        if (!cancelModal.message.trim()) return;
        setCancelModal((prev) => ({ ...prev, loading: true }));
        try {
            await apiRequestCancellation(cancelModal.appointmentId, cancelModal.message.trim(), token!);
            setCancelModal({ open: false, appointmentId: "", message: "", loading: false });
            emitAppointmentsChanged();
            await refresh();
            toastT.success(["toasts.appointments.cancelSuccess"]);
        } catch (e: unknown) {
            toastT.error(getApiErrorMessage(e, ["toasts.appointments.cancelError"]));
            setCancelModal((prev) => ({ ...prev, loading: false }));
        }
    };

    const handleDelete = async (id: string) => {
        const ok = window.confirm(t("pages.appointments.worker.confirmDelete"));
        if (!ok) return;
        try {
            await apiDeleteMyAppointment(id, token!);
            emitAppointmentsChanged();
            await refresh();
            toastT.success(["toasts.appointments.deleteSuccess"]);
        } catch (e: unknown) {
            toastT.error(getApiErrorMessage(e, ["toasts.appointments.deleteError"]));
        }
    };

    const emptyState = !loading && items.length === 0;

    return (
        <div className="max-w-5xl mx-auto p-4 bg-white rounded shadow">
            <div className="flex items-start justify-between">
                <h2 className="text-xl font-bold">
                    {t("pages.appointments.worker.title")}
                </h2>
                <CreateIconButton
                    onClick={() => setOpenRequest(true)}
                    label={t("pages.appointments.actions.request")}
                />

            </div>

            {/* Estado de carga */}
            {loading && (
                <p className="mt-4 text-gray-600">
                    {t("pages.appointments.status.loadingMine")}
                </p>
            )}

            {/* Mis solicitudes */}
            {!loading && recent.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-base font-semibold mb-3">
                        {t("pages.appointments.requests.title")}
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full table-fixed text-sm">
                            <colgroup>
                                <col className="w-[22%]" />
                                <col className="w-[12%]" />
                                <col className="w-[18%]" />
                                <col className="w-[16%]" />
                                <col className="w-[32%]" />
                            </colgroup>
                            <thead className={APP_NAV_MATCH_TABLE_THEAD_STICKY}>
                                <tr className="text-center text-slate-200">
                                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                        {t("pages.appointments.labels.reason")}
                                    </th>
                                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                        {t("pages.appointments.labels.message")}
                                    </th>
                                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                        {t("pages.appointments.labels.sentAt")}
                                    </th>
                                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                        {t("pages.appointments.labels.status").replace(":", "")}
                                    </th>
                                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                                {recent.map((a) => {
                                    const showChoose =
                                        a.status === "proposed" &&
                                        (a.proposedSlots?.length ?? 0) > 0;
                                    return (
                                        <tr
                                            key={a._id}
                                            className="border-b border-slate-100 hover:bg-slate-50/70 text-center"
                                        >
                                            <td className="px-3 py-2 align-top">
                                                <span className="font-medium text-slate-800 break-words">
                                                    {a.reason}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 align-top whitespace-nowrap">
                                                {((a.status === "proposed" && (a.proposedSlots?.length ?? 0) > 0) ||
                                                    !!a.details?.trim()) ? (
                                                    <ViewIconButton
                                                        onClick={() => openAppointmentMessage(a)}
                                                        title={t("pages.appointments.messageModal.open")}
                                                    />
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 align-top whitespace-nowrap text-slate-700">
                                                {fmt(a.createdAt)}
                                            </td>
                                            <td className="px-3 py-2 align-top whitespace-nowrap">
                                                <StatusBadge
                                                    tone={toneForAppointmentStatus(a.status)}
                                                    label={statusLabel(a.status)}
                                                />
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <div className="flex items-center justify-center gap-2">
                                                    {showChoose && (
                                                        <ProposeSlotsIconButton
                                                            onClick={() => {
                                                                setChooseId(a._id);
                                                                setChooseSlots(a.proposedSlots);
                                                                setOpenChoose(true);
                                                            }}
                                                            title={t(
                                                                "pages.appointments.actions.chooseSlotTitle",
                                                            )}
                                                        />
                                                    )}
                                                    {a.status === "proposed" &&
                                                        (a.proposedSlots?.length ?? 0) === 0 && (
                                                            <span className="text-xs text-amber-700">
                                                                {t("pages.appointments.requests.waitingOptions")}
                                                            </span>
                                                        )}
                                                    {a.status === "cancellation_requested" ? (
                                                        <span className="text-xs text-amber-700">Pendiente admin</span>
                                                    ) : (
                                                        <StopIconButton
                                                            onClick={() => setCancelModal({ open: true, appointmentId: a._id, message: "", loading: false })}
                                                            title="Solicitar cancelación"
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Aceptadas y otras citas */}
            {!loading && others.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-base font-semibold mb-3">
                        {t("pages.appointments.history.title")}
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full table-fixed text-sm">
                            <colgroup>
                                <col className="w-[22%]" />
                                <col className="w-[12%]" />
                                <col className="w-[18%]" />
                                <col className="w-[16%]" />
                                <col className="w-[32%]" />
                            </colgroup>
                            <thead className={APP_NAV_MATCH_TABLE_THEAD_STICKY}>
                                <tr className="text-center text-slate-200">
                                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                        {t("pages.appointments.labels.reason")}
                                    </th>
                                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                        {t("pages.appointments.labels.message")}
                                    </th>
                                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                        {t("pages.appointments.labels.when")}
                                    </th>
                                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                        {t("pages.appointments.labels.status").replace(":", "")}
                                    </th>
                                    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                                {others.map((a) => (
                                    <tr
                                        key={a._id}
                                        className="border-b border-slate-100 hover:bg-slate-50/70 text-center"
                                    >
                                        <td className="px-3 py-2 align-top">
                                            <span className="font-medium text-slate-800 break-words">
                                                {a.reason}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 align-top whitespace-nowrap">
                                            {((a.status === "proposed" && (a.proposedSlots?.length ?? 0) > 0) ||
                                                !!a.details?.trim() ||
                                                !!a.cancellationMessage?.trim()) ? (
                                                <ViewIconButton
                                                    onClick={() => openAppointmentMessage(a)}
                                                    title={t("pages.appointments.messageModal.open")}
                                                />
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 align-top whitespace-nowrap text-slate-700">
                                            {fmt(a.selectedSlot?.start)}
                                        </td>
                                        <td className="px-3 py-2 align-top whitespace-nowrap">
                                            <StatusBadge
                                                tone={toneForAppointmentStatus(a.status)}
                                                label={statusLabel(a.status)}
                                            />
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            <div className="flex items-center justify-center">
                                                {a.status === "cancelled" ? (
                                                    <StopIconButton
                                                        onClick={() => handleDelete(a._id)}
                                                        title={t("pages.appointments.worker.actions.deleteTitle")}
                                                    />
                                                ) : (
                                                    <StopIconButton
                                                        onClick={() => setCancelModal({ open: true, appointmentId: a._id, message: "", loading: false })}
                                                        title="Solicitar cancelación"
                                                    />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Estado vacío */}
            {emptyState && (
                <div className="mt-6 rounded-xl border border-gray-200 p-6 text-center">
                    <p className="text-gray-600">
                        {t("pages.appointments.empty.worker")}
                    </p>
                </div>
            )}


            {/* Modal: solicitar cancelación */}
            {cancelModal.open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4">
                    <div
                        className="fixed inset-0 bg-black/50"
                        onClick={() => setCancelModal((p) => ({ ...p, open: false }))}
                    />
                    <div
                        className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
                            <h3 className="text-sm font-semibold text-slate-900">Solicitar cancelación</h3>
                            <button
                                type="button"
                                onClick={() => setCancelModal((p) => ({ ...p, open: false }))}
                                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="px-3 py-3 space-y-3 text-sm">
                            <p className="text-slate-500 text-xs">
                                Indica el motivo de cancelación. El administrador recibirá tu solicitud y deberá aceptarla.
                            </p>
                            <textarea
                                value={cancelModal.message}
                                onChange={(e) => setCancelModal((p) => ({ ...p, message: e.target.value }))}
                                placeholder="Motivo de cancelación..."
                                maxLength={1000}
                                rows={4}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                            />
                        </div>
                        <div className="border-t border-slate-200 px-3 py-2 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setCancelModal((p) => ({ ...p, open: false }))}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none"
                                disabled={cancelModal.loading}
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleRequestCancellation()}
                                disabled={cancelModal.loading || !cancelModal.message.trim()}
                                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 focus:outline-none disabled:opacity-50"
                            >
                                {cancelModal.loading ? "Enviando…" : "Enviar solicitud"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: pedir cita */}
            <RequestAppointmentModal
                isOpen={openRequest}
                onClose={() => setOpenRequest(false)}
                onSuccess={refresh}
            />

            {/* Modal: elegir slot */}
            <ChooseSlotModal
                isOpen={openChoose}
                onClose={() => setOpenChoose(false)}
                appointmentId={chooseId}
                proposedSlots={chooseSlots}
                onSuccess={async () => {
                    await refresh();
                    setOpenChoose(false);
                }}
            />

            {openMessageModal && messageAppointment && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4">
                    <div
                        className="fixed inset-0 bg-black/50"
                        onClick={() => setOpenMessageModal(false)}
                    />
                    <div
                        className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="appointment-message-title"
                    >
                        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
                            <h3 id="appointment-message-title" className="text-sm font-semibold text-slate-900">
                                {t("pages.appointments.messageModal.title")}
                            </h3>
                            <button
                                onClick={() => setOpenMessageModal(false)}
                                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="px-3 py-3 space-y-3 text-sm">
                            <div>
                                <p className="text-xs font-medium text-slate-500">
                                    {t("pages.appointments.labels.reason")}
                                </p>
                                <p className="text-slate-800">{messageAppointment.reason}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500">
                                    {t("pages.appointments.labels.message")}
                                </p>
                                <p className="text-slate-700 whitespace-pre-wrap break-words">
                                    {messageAppointment.details || t("pages.appointments.messageModal.noMessage")}
                                </p>
                            </div>
                            {messageAppointment.proposedSlots?.length ? (
                                <div>
                                    <p className="text-xs font-medium text-slate-500">
                                        {t("pages.appointments.labels.proposedSlots")}
                                    </p>
                                    <ul className="mt-1 space-y-1 text-slate-700">
                                        {messageAppointment.proposedSlots.map((slot, idx) => (
                                            <li key={`${slot.start}-${idx}`} className="rounded bg-slate-50 px-2 py-1">
                                                {t("pages.appointments.propose.optionLegend", { index: idx + 1 })}: {fmt(slot.start)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                        <div className="border-t border-slate-200 px-3 py-2 flex justify-end">
                            <button
                                onClick={() => setOpenMessageModal(false)}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                {t("pages.appointments.messageModal.close")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
