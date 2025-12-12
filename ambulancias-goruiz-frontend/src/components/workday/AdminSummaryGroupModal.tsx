// src/components/workday/AdminSummaryGroupModal.tsx
import React from "react";
import type { WorkdaySummary } from "../../types/workdaySummary";
import type { AssignedDayFull } from "../../types/dienst";
import ReviewSummary from "./ReviewSummary";
import { useTranslation } from "react-i18next";

/**
 * Mapeo de WorkdaySummary (lo que recibe el admin)
 * a AssignedDayFull (lo que espera ReviewSummary).
 */
function mapSummaryToAssignedDay(summary: WorkdaySummary): AssignedDayFull {
  const s: any = summary;

  return {
    assignmentId: summary.assignmentId,
    dienstId: s.dienstId || summary.assignmentId,
    dienstNumber: s.dienstNumber ?? 0,
    date: summary.date,
    startTime: summary.startTime || "",
    endTime: summary.endTime || "",
    ambulanceId: s.ambulanceId,
    driver:
      typeof s.driver === "object" && s.driver !== null
        ? s.driver
        : { name: "", lastName: s.driver as string, _id: "" },
    medic:
      typeof s.medic === "object" && s.medic !== null
        ? s.medic
        : { name: "", lastName: s.medic as string, _id: "" },
  };
}

interface AdminSummaryGroupModalProps {
  /** Controla si el modal está visible */
  isOpen: boolean;
  /** Cerrar el modal */
  onClose: () => void;
  /**
   * Grupo de resúmenes que pertenecen al mismo Dienst (mismo equipo / día):
   * puede incluir parcial(es) y uno final.
   */
  summaries: WorkdaySummary[];
}

/**
 * Modal de solo lectura para el admin.
 * Muestra uno o varios resúmenes (parciales + final) del mismo Dienst,
 * reutilizando ReviewSummary para cada uno.
 */
const AdminSummaryGroupModal: React.FC<AdminSummaryGroupModalProps> = ({
  isOpen,
  onClose,
  summaries,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;
  if (!summaries || summaries.length === 0) return null;

  // Ordenamos: primero parciales, luego final
  const sorted = [...summaries].sort((a, b) => {
    const aIsPartial = !a.isFinalClosure;
    const bIsPartial = !b.isFinalClosure;
    if (aIsPartial === bIsPartial) return 0;
    return aIsPartial ? -1 : 1;
  });

  // Tomamos datos comunes del grupo (mismo día, mismo dienst)
  const first = sorted[0] as any;
  const dienstNumber = first.dienstNumber ?? "-";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
        {/* Header del modal */}
        <div className="flex items-center justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {t("pages.summaries.admin.detail.title", "Detalles del Dienst")}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {t("pages.summaries.admin.detail.subtitle", {
                dienst: dienstNumber,
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("common.close", "Cerrar")}
          </button>
        </div>

        {/* Lista de resúmenes del grupo */}
        <div className="space-y-6">
          {sorted.map((summary) => {
            const s: any = summary;
            const assignedDay = mapSummaryToAssignedDay(summary);
            const reviewedAt = s.reviewedAt as string | undefined;


            const label = summary.isFinalClosure
              ? t("pages.summaries.admin.detail.badge.final", "Cierre final")
              : t("pages.summaries.admin.detail.badge.partial", "Reporte parcial");

            const note =
              s.extraNote ||
              s.partialClosureReason ||
              t("pages.summaries.admin.detail.noNote", "Sin nota adicional");

            const ambulanceNumber =
              s.ambulanceNumber ??
              t("pages.workday.common.unknownAmbulance", "Ambulancia desconocida");

            const initialKm = summary.initialKm;
            const finalKm = summary.finalKm ?? summary.initialKm;

            return (
              <div
                key={s._id ?? `${summary.assignmentId}-${summary.isFinalClosure ? "final" : "partial"}`}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
              >
                {/* Encabezado de cada bloque (parcial / final) */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${summary.isFinalClosure
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                        }`}
                    >
                      {label}
                    </span>

                    {s.totalEffectivePatients != null && (
                      <span className="text-[11px] text-slate-700">
                        {t(
                          "pages.summaries.admin.detail.effectivePatients",
                          "Viajes Prämie: {{count}}",
                          { count: s.totalEffectivePatients }
                        )}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500">
                    {t(
                      "pages.summaries.admin.detail.closureTime",
                      "Cierre registrado"
                    )}
                    {reviewedAt
                      ? ` · ${new Date(reviewedAt).toLocaleString()}`
                      : ""}
                  </div>

                </div>

                {/* Nota / motivo de este resumen */}
                <p className="text-[12px] text-slate-700 italic">
                  {note}
                </p>

                {/* Tabla con viajes y km usando ReviewSummary */}
                <ReviewSummary
                  assignedDay={assignedDay}
                  ambulanceNumber={ambulanceNumber}
                  initialKm={initialKm}
                  finalKm={finalKm}
                  trips={[...summary.trips].sort((a, b) =>
                    a.timeWarning.localeCompare(b.timeWarning)
                  )}
                  dense
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminSummaryGroupModal;
