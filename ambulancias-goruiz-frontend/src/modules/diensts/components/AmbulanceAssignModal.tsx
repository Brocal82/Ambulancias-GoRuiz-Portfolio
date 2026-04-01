import { useEffect, useId, useState } from "react";

import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { getAllAmbulances } from "../../ambulances/domain/api";
import type { Ambulance } from "../../ambulances/domain/types";
import { toastT } from "../../../utils/toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (ambulanceId: string) => Promise<void> | void;
}

export default function AmbulanceAssignModal({
  isOpen,
  onClose,
  onConfirm,
}: Props) {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [openList, setOpenList] = useState(false);

  const selectId = useId();

  useEffect(() => {
    if (!isOpen || !token) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getAllAmbulances();
        if (!cancelled) setAmbulances(data);
      } catch (e) {
        console.error(e);
        toastT.error(["toasts.ambulances.loadError"]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, token]);

  // Reset selection when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedId("");
      setOpenList(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedAmbulance = ambulances.find((a) => a._id === selectedId) ?? null;

  const renderSelectedLabel = () => {
    if (loading) return t("common.loading");
    if (!selectedAmbulance) return t("common.select");
    return `${selectedAmbulance.ambulanceNumber} — ${selectedAmbulance.brand} ${selectedAmbulance.modelName} (${selectedAmbulance.licensePlate})`;
  };

  const canConfirm = !!selectedId && !loading;

  const handleClose = () => {
    setOpenList(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          {t("pages.diensts.assignAmbulanceModal.title", "Asignar ambulancia a la semana")}
        </h3>

        <div className="space-y-2">
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-slate-700"
          >
            {t("pages.diensts.assignAmbulanceModal.select", "Selecciona una ambulancia")}
          </label>

          <div className="relative">
            <button
              id={selectId}
              type="button"
              className="w-full flex items-center justify-between rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              onClick={() => setOpenList((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={openList}
            >
              <span className="truncate">{renderSelectedLabel()}</span>
              <svg
                className="h-4 w-4 shrink-0 text-slate-500"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {openList && !loading && (
              <div
                role="listbox"
                tabIndex={-1}
                aria-label="Opciones del selector"
                className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-200"
              >
                {ambulances.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-500">
                    {t("pages.adminAmbulances.empty", "No hay ambulancias disponibles.")}
                  </div>
                )}
                {ambulances.map((amb) => {
                  const isSelected = selectedId === amb._id;
                  return (
                    <button
                      key={amb._id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedId(amb._id);
                        setOpenList(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none${isSelected ? " bg-slate-50" : ""}`}
                    >
                      <span className="font-medium">{amb.ambulanceNumber}</span>
                      <span className="text-slate-500"> — {amb.brand} {amb.modelName}</span>
                      <span className="text-slate-400 text-xs ml-1">({amb.licensePlate})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <button
            className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
            disabled={!canConfirm}
            onClick={async () => {
              if (!selectedId) return;
              await onConfirm(selectedId);
            }}
          >
            {t("pages.diensts.assignAmbulanceModal.confirm", "Asignar a toda la semana")}
          </button>
          <button
            className="w-full rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100"
            onClick={handleClose}
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
