// frontend/src/modules/appointments/pages/WorkerAppointmentsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";

import {
    getMyAppointments,
    deleteMyAppointment as apiDeleteMyAppointment,
} from "../domain";

import {
    RequestAppointmentModal,
    ChooseSlotModal,
} from "../components";

import type { Appointment } from "../../../types/appointment";
import { toastT } from "../../../utils/toast";
import { APP_TZ } from "../../../config/app";
import { useTranslation } from "react-i18next";
import StatusBadge from "../../../components/common/StatusBadge";
import { toneForAppointmentStatus } from "../utils/appointmentTone";
import CreateIconButton from "../../../components/common/actions/CreateIconButton";

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

    const refresh = async () => {
        try {
            const data = await getMyAppointments(token!);
            setItems(data);
        } catch (e: any) {
            toastT.error(
                e?.response?.data?.message ?? ["toasts.appointments.loadError"],
            );
        }
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const data = await getMyAppointments(token!);
                if (mounted) setItems(data);
            } catch (e: any) {
                toastT.error(
                    e?.response?.data?.message ?? ["toasts.appointments.loadError"],
                );
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [token]);

    // Traducción de estado
    const statusLabel = (s: Appointment["status"]) =>
        t(`pages.appointments.statusLabel.${s}`);


    // Próxima cita confirmada / reprogramada (futura más cercana)
    const nextConfirmed = useMemo(() => {
        const now = Date.now();
        return items
            .filter(
                (a) =>
                    (a.status === "confirmed" || a.status === "rescheduled") &&
                    a.selectedSlot?.start &&
                    new Date(a.selectedSlot.start).getTime() > now,
            )
            .sort(
                (x, y) =>
                    new Date(x.selectedSlot!.start).getTime() -
                    new Date(y.selectedSlot!.start).getTime(),
            )[0];
    }, [items]);

    // Solicitudes (pending/proposed) — ORDENADAS:
    // - Si tiene opciones: por la hora propuesta más temprana (ASC)
    // - Si no tiene opciones: por fecha de creación (DESC)
    const recent = useMemo(() => {
        const arr = items.filter(
            (a) => a.status === "pending" || a.status === "proposed",
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

    // Otras citas: confirmed/rescheduled/cancelled (excluye la mostrada como "próxima")
    // ORDENADAS por selectedSlot.start ASC (más antiguas arriba, más nuevas abajo)
    const others = useMemo(() => {
        const excludeId = nextConfirmed?._id;
        return items
            .filter(
                (a) =>
                    a.status === "confirmed" ||
                    a.status === "rescheduled" ||
                    a.status === "cancelled",
            )
            .filter((a) => a._id !== excludeId)
            .sort((a, b) => selectedStartMs(a) - selectedStartMs(b)); // 👈 ASC
    }, [items, nextConfirmed]);

    const canDelete = (a: Appointment): boolean => {
        if (a.status === "cancelled") return true;
        const endMs = a.selectedSlot?.end
            ? new Date(a.selectedSlot.end).getTime()
            : a.selectedSlot?.start
                ? new Date(a.selectedSlot.start).getTime()
                : 0;
        return endMs > 0 && endMs < Date.now();
    };

    const handleDelete = async (id: string) => {
        const ok = window.confirm(t("pages.appointments.worker.confirmDelete"));
        if (!ok) return;
        try {
            await apiDeleteMyAppointment(id, token!);
            await refresh();
            toastT.success(["toasts.appointments.deleteSuccess"]);
        } catch (e: any) {
            toastT.error(
                e?.response?.data?.message ?? ["toasts.appointments.deleteError"],
            );
        }
    };

    const emptyState = !loading && items.length === 0;

    return (
        <div className="max-w-4xl mx-auto p-4 bg-white rounded shadow">
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

            {/* Próxima cita confirmada */}
            {!loading && nextConfirmed && (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-emerald-800">
                            {t("pages.appointments.next.title")}
                        </h3>
                        <StatusBadge
                            tone={toneForAppointmentStatus(nextConfirmed.status)}
                            label={statusLabel(nextConfirmed.status)}
                        />


                    </div>
                    <div className="mt-2 text-sm text-emerald-900">
                        <div>
                            <span className="font-medium">
                                {t("pages.appointments.labels.when")}
                            </span>{" "}
                            {fmt(nextConfirmed.selectedSlot?.start)}
                        </div>
                        <div className="mt-1">
                            <span className="font-medium">
                                {t("pages.appointments.labels.reason")}
                            </span>{" "}
                            {nextConfirmed.reason}
                        </div>
                    </div>
                </div>
            )}

            {/* Mis solicitudes */}
            {!loading && recent.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-base font-semibold mb-3">
                        {t("pages.appointments.requests.title")}
                    </h3>
                    <ul className="space-y-3">
                        {recent.map((a) => {
                            const showChoose =
                                a.status === "proposed" && (a.proposedSlots?.length ?? 0) > 0;
                            return (
                                <li
                                    key={a._id}
                                    className="rounded-xl border p-4 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        {/* Columna izquierda con motivo y detalles */}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium truncate">{a.reason}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">{a.details}</p>

                                            {a.status === "proposed" &&
                                                (a.proposedSlots?.length ?? 0) === 0 && (
                                                    <p className="mt-2 text-sm text-amber-700">
                                                        {t("pages.appointments.requests.waitingOptions")}
                                                    </p>
                                                )}
                                        </div>

                                        {/* Columna derecha: botón y status */}
                                        <div className="shrink-0 flex flex-row items-center gap-2">
                                            {showChoose && (
                                                <button
                                                    className="shrink-0 rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 whitespace-nowrap"
                                                    onClick={() => {
                                                        setChooseId(a._id);
                                                        setChooseSlots(a.proposedSlots);
                                                        setOpenChoose(true);
                                                    }}
                                                    title={t(
                                                        "pages.appointments.actions.chooseSlotTitle",
                                                    )}
                                                >
                                                    {t("pages.appointments.actions.chooseSlot")}
                                                </button>
                                            )}
                                            <StatusBadge
                                                tone={toneForAppointmentStatus(a.status)}
                                                label={statusLabel(a.status)}
                                            />


                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Historial y otras citas */}
            {!loading && others.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-base font-semibold mb-3">
                        {t("pages.appointments.history.title")}
                    </h3>
                    <ul className="space-y-3">
                        {others.map((a) => (
                            <li
                                key={a._id}
                                className="relative rounded-xl border p-4 hover:bg-slate-50 transition-colors"
                            >
                                {/* Botón cerrar absolutamente en la esquina superior derecha */}
                                {canDelete(a) && (
                                    <button
                                        onClick={(e) => {
                                            e.currentTarget.blur();
                                            handleDelete(a._id);
                                        }}
                                        className="absolute top-2 right-2 bg-transparent p-0 text-rose-600 hover:text-rose-700
                 font-bold text-lg leading-none focus:outline-none
                 focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
                                        title={t("pages.appointments.worker.actions.deleteTitle")}
                                        aria-label={t(
                                            "pages.appointments.worker.actions.deleteTitle",
                                        )}
                                    >
                                        ×
                                    </button>
                                )}

                                {/* Contenido izquierda */}
                                <div className="pr-10">
                                    <div className="font-medium truncate">{a.reason}</div>
                                    <p className="text-sm text-gray-600 mt-1">{a.details}</p>
                                    <div className="text-sm text-gray-700 mt-2">
                                        <span className="font-medium">
                                            {t("pages.appointments.labels.when")}
                                        </span>{" "}
                                        {fmt(a.selectedSlot?.start)}
                                    </div>
                                </div>

                                {/* Status fijo en la esquina inferior derecha */}
                                <div className="absolute bottom-2 right-2">
                                    <StatusBadge
                                        tone={toneForAppointmentStatus(a.status)}
                                        label={statusLabel(a.status)}
                                    />


                                </div>
                            </li>
                        ))}
                    </ul>
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
        </div>
    );
}
