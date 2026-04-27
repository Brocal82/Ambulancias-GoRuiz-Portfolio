// frontend/src/modules/appointments/components/ChooseSlotModal.tsx
import { useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { rejectProposal, selectSlot } from "../domain";
import { emitAppointmentsChanged } from "../utils/appointmentEvents";
import type { TimeSlot } from "../domain/types";
import { toastT, getApiErrorMessage } from "../../../utils/toast";
import { useTranslation } from "react-i18next";
import StopIconButton from "../../../components/common/actions/StopIconButton";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  proposedSlots: TimeSlot[];
  onSuccess?: () => void; // refrescar lista tras confirmar
}

export default function ChooseSlotModal({
  isOpen,
  onClose,
  appointmentId,
  proposedSlots,
  onSuccess,
}: Props) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const slotsBerlin = useMemo(() => {
    return (proposedSlots || []).map((s) => ({
      ...s,
      label: new Date(s.start).toLocaleString("de-DE", {
        timeZone: "Europe/Berlin",
      }),
    }));
  }, [proposedSlots]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (selectedIndex === null) {
      // toasts: fase aparte; dejamos el texto como está
      toastT.warn(["toasts.appointments.chooseRequired"]);
      return;
    }
    try {
      setLoading(true);
      const sel = proposedSlots[selectedIndex];
      await selectSlot(appointmentId, { selectedSlot: sel }, token!);
      toastT.success(["toasts.appointments.confirmSuccess"]);
      emitAppointmentsChanged();
      onClose();
      onSuccess?.();
    } catch (e: unknown) {
      toastT.error(getApiErrorMessage(e, ["toasts.appointments.confirmError"]));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelProposal = async () => {
    const ok = window.confirm(t("pages.appointments.choose.confirmCancelProposal"));
    if (!ok) return;
    try {
      setLoading(true);
      await rejectProposal(appointmentId, token!);
      toastT.success(["toasts.appointments.rejectProposalSuccess"]);
      emitAppointmentsChanged();
      onClose();
      onSuccess?.();
    } catch (e: unknown) {
      toastT.error(getApiErrorMessage(e, ["toasts.appointments.rejectProposalError"]));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="choose-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h2
              id="choose-title"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              {t("pages.appointments.choose.title")}
            </h2>
            <button
              onClick={onClose}
              className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
              aria-label={t("pages.appointments.choose.actions.cancel")}
              disabled={loading}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Opciones */}
        <div className="px-6 py-4 space-y-3">
          {slotsBerlin.length === 0 ? (
            <p className="text-sm text-slate-600">
              {t("pages.appointments.choose.empty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {slotsBerlin.map((s, idx) => (
                <li key={idx}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="slot"
                      aria-label={t("pages.appointments.choose.optionAria", {
                        index: idx + 1,
                        label: s.label,
                      })}
                      checked={selectedIndex === idx}
                      onClick={() =>
                        setSelectedIndex((prev) => (prev === idx ? null : idx))
                      }
                      onChange={() => undefined}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-sm text-slate-800">{s.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          {selectedIndex === null ? (
            <StopIconButton
              onClick={handleCancelProposal}
              title={t("pages.appointments.choose.actions.cancelProposal")}
              disabled={loading || slotsBerlin.length === 0}
            />
          ) : (
            <button
              onClick={handleConfirm}
              className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100 text-white disabled:opacity-60"
              disabled={loading || slotsBerlin.length === 0}
              title={
                loading
                  ? t("pages.appointments.choose.actions.confirming")
                  : t("pages.appointments.choose.actions.confirm")
              }
              aria-label={
                loading
                  ? t("pages.appointments.choose.actions.confirming")
                  : t("pages.appointments.choose.actions.confirm")
              }
            >
              {loading ? "…" : "✅"}
            </button>
          )}
          </div>
        
      </div>
    </div>
  );
}
