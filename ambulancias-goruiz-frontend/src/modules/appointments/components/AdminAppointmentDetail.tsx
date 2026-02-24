import { useEffect, useMemo, useState } from "react";
import type { Appointment } from "../../../types/appointment";
import { useAuth } from "../../../hooks/useAuth";
import { cancelAppointment, updateAppointment } from "../../../api/appointments";
import { toastT } from "../../../utils/toast";
import { APP_TZ } from "../../../config/app";
import { partsFromISO, localDateTimeToUtcISO } from "../../../utils/tz";
import { useTranslation } from "react-i18next";
import StatusBadge from "../../../components/common/StatusBadge";
import { toneForAppointmentStatus } from "../../../utils/status/appointmentTone";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  item: Appointment | null;
  onChanged?: () => void;
};

const DEFAULT_DURATION_MIN = 30;

const AdminAppointmentDetail: React.FC<Props> = ({
  isOpen,
  onClose,
  item,
  onChanged,
}) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [reDate, setReDate] = useState("");
  const [reTime, setReTime] = useState("");

  useEffect(() => {
    if (!isOpen || !item) return;
    setEditMode(false);
    const { date, time } = partsFromISO(item.selectedSlot?.start, APP_TZ);
    setReDate(date);
    setReTime(time);
  }, [isOpen, item]);

  const saveDisabled = useMemo(() => {
    if (!editMode) return true;
    return !reDate || !reTime;
  }, [editMode, reDate, reTime]);

  if (!isOpen || !item) return null;

  const isCancelled = item.status === "cancelled";

  const worker =
    typeof item.workerId === "object"
      ? `${item.workerId.lastName}, ${item.workerId.name}`
      : String(item.workerId);

  const when = item.selectedSlot?.start
    ? new Date(item.selectedSlot.start).toLocaleString("de-DE", {
      timeZone: APP_TZ,
    })
    : "—";

  const statusLabel = t(`pages.appointments.statusLabel.${item.status}`);

  const handleCancelAppointment = async () => {
    if (!item?._id) return;
    const ok = window.confirm(t("pages.appointments.detail.confirmCancel"));
    if (!ok) return;
    try {
      setLoading(true);
      await cancelAppointment(item._id, token!);
      toastT.success(["toasts.appointments.cancelSuccess"]);
      onClose();
      onChanged?.();
    } catch (e: any) {
      toastT.error(
        e?.response?.data?.message ?? ["toasts.appointments.cancelError"],
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!item?._id) return;
    const conv = localDateTimeToUtcISO(
      APP_TZ,
      reDate,
      reTime,
      DEFAULT_DURATION_MIN,
    );
    if (!conv) {
      toastT.warn(["toasts.appointments.invalidDateTime"]);
      return;
    }
    if (conv.start.getTime() <= Date.now()) {
      toastT.warn(["toasts.appointments.pastDateError"]);
      return;
    }
    try {
      setLoading(true);
      await updateAppointment(
        item._id,
        { selectedSlot: { start: conv.startISO, end: conv.endISO } },
        token!,
      );
      toastT.success(["toasts.appointments.rescheduleSuccess"]);
      setEditMode(false);
      onClose();
      onChanged?.();
    } catch (e: any) {
      toastT.error(
        e?.response?.data?.message ?? ["toasts.appointments.rescheduleError"],
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-xl rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appt-detail-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <h3
              id="appt-detail-title"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              {t("pages.appointments.detail.title")}
            </h3>

            {/* Status pill */}
            <StatusBadge
              label={statusLabel}
              tone={toneForAppointmentStatus(item.status)}
            />


          </div>

          {!isCancelled && !editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
              title={t("pages.appointments.detail.rebookTitle")}
            >
              {t("pages.appointments.detail.rebook")}
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-5">
          {/* Datos principales en grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">
                {t("pages.appointments.detail.labels.worker")}
              </div>
              <div className="mt-0.5 text-sm font-medium text-slate-900">
                {worker}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">
                {t("pages.appointments.detail.labels.currentWhen")}
              </div>
              <div className="mt-0.5 text-sm font-medium text-slate-900">
                {when}
              </div>
            </div>
          </div>

          {/* Motivo */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">
              {t("pages.appointments.detail.labels.reason")}
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {item.reason}
            </div>
          </div>

          {/* Descripción */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">
              {t("pages.appointments.detail.labels.description")}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {item.details}
            </div>
          </div>

          {/* Reprogramar: SOLO visible en editMode */}
          {!isCancelled && editMode && (
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 text-sm font-semibold text-slate-800">
                {t("pages.appointments.detail.rebook")}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="re-date"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    {t("pages.appointments.detail.inputs.newDate")}
                  </label>
                  <input
                    id="re-date"
                    type="date"
                    value={reDate}
                    onChange={(e) => setReDate(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label
                    htmlFor="re-time"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    {t("pages.appointments.detail.inputs.newTime")}
                  </label>
                  <input
                    id="re-time"
                    type="time"
                    value={reTime}
                    onChange={(e) => setReTime(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer (sin cambios funcionales) */}
        <div className="flex justify-between gap-2 border-t border-slate-200 px-6 py-4">
          {!editMode ? (
            <>
              <button
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
                disabled={loading}
              >
                {t("pages.appointments.detail.actions.close")}
              </button>

              {!isCancelled && (
                <button
                  onClick={handleCancelAppointment}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:opacity-60"
                  disabled={loading}
                >
                  {loading
                    ? t("pages.appointments.detail.actions.deleting")
                    : t("pages.appointments.detail.actions.delete")}
                </button>
              )}
            </>
          ) : (
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setEditMode(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-60"
                disabled={loading}
              >
                {t("pages.appointments.detail.actions.cancelEdit")}
              </button>

              <button
                onClick={handleSave}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
                disabled={loading || saveDisabled}
              >
                {loading
                  ? t("pages.appointments.detail.actions.saving")
                  : t("pages.appointments.detail.actions.save")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAppointmentDetail;
