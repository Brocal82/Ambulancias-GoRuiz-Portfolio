//src/components/hospitals/HospitalDetailsModal.tsx
import type { Hospital } from "../../types/hospital";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getHospitalIsOpen } from "../../utils/hospitals/status";


interface Props {
  hospital: Hospital;
  onClose: () => void;
}

const HospitalDetailsModal = ({ hospital, onClose }: Props) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Cerrar al hacer click en el backdrop
  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isOpen = getHospitalIsOpen(hospital);


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={onBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hospital-details-title"
        className="w-full max-w-2xl rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 outline-none animate-[fadeIn_120ms_ease-out]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
              <span aria-hidden>🏥</span>
            </div>
            <h2
              id="hospital-details-title"
              className="text-lg md:text-xl font-bold text-slate-900"
            >
              {hospital.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t("common.close", "Cerrar")}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {/* Columna izquierda */}
            <div className="space-y-3">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wide">
                  {t("pages.hospitals.detailsModal.address", "Dirección")}
                </p>
                <p className="mt-0.5 font-medium text-slate-900">
                  {hospital.address || "—"}
                </p>
              </div>

              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wide">
                  {t("pages.hospitals.detailsModal.phone", "Teléfono")}
                </p>
                <p className="mt-0.5 font-medium text-slate-900">
                  {hospital.phone || "—"}
                </p>
              </div>
            </div>

            {/* Columna derecha */}
            <div className="space-y-2 md:border-l md:pl-6 border-slate-200">
              <p className="text-slate-500 text-xs uppercase tracking-wide">
                {t(
                  "pages.hospitals.detailsModal.specialties",
                  "Especialidades",
                )}
              </p>

              {hospital.specialties?.length ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {hospital.specialties.map((spec) => (
                    <span
                      key={spec}
                      className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-0.5 text-slate-500">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer: badge de estado abajo a la derecha (si hay dato) */}
        {typeof isOpen === "boolean" && (
          <div className="px-6 py-3 border-t border-slate-200 flex justify-end">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${isOpen
                ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                }`}
            >
              {isOpen
                ? t("pages.hospitals.status.open", "Abierto")
                : t("pages.hospitals.status.closed", "Cerrado")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HospitalDetailsModal;
