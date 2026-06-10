// src/components/workday/AdminSummaryGroupModal.tsx
import React from "react";
import type { WorkdaySummary } from "../domain";
import { useTranslation } from "react-i18next";
import AdminWorkdaySummaryGroupContent from "./AdminWorkdaySummaryGroupContent";

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

    const first = summaries[0] as WorkdaySummary;
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

                <AdminWorkdaySummaryGroupContent summaries={summaries} />
            </div>
        </div>
    );
};

export default AdminSummaryGroupModal;
