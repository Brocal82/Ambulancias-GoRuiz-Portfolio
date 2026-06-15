import React, { useState } from "react";
import type { Trip } from "../domain/types/trip";
import type { AssignedDayFull } from "../../../modules/diensts";
import ReviewSummary from "./ReviewSummary";
import { toastT } from "../../../utils/toast";
import { calculateEffectivePatients } from "../../praemien/utils/calculateEffectivePatients";
import { IssueReportModal } from "../../mechanics";
import { useTranslation } from "react-i18next";
import { usePraemienWorkdayUiActive } from "../../../hooks/usePraemienWorkdayUiActive";

interface Props {
    trips: Trip[];
    assignedDay: AssignedDayFull;
    ambulanceId: string;
    ambulanceNumber: string;
    initialKm: string;
    finalKm: string;
    /** Si false, no se muestra flujo de avería (módulo mechanics desactivado). */
    mechanicsModuleOn: boolean;
    onClose: () => void;
    onSend: (
        report: string,
        finalKm: number,
        totalEffectivePatients: number,
        issueData?: any,
    ) => Promise<void>;

}

const PartialReviewModal: React.FC<Props> = ({
    trips,
    assignedDay,
    ambulanceId,
    ambulanceNumber,
    initialKm,
    mechanicsModuleOn,
    onClose,
    onSend,
}) => {
    const { t } = useTranslation();
    const praemienWorkdayUiActive = usePraemienWorkdayUiActive();

    const [report, setReport] = useState("");
    const [finalKm, setFinalKm] = useState<number | "">("");
    const [hasIssue, setHasIssue] = useState(false);
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [issueData, setIssueData] = useState<any | null>(null);
    const [isSending, setIsSending] = useState(false);

    const parsedInitialKm = Number(initialKm);
    const parsedFinalKm = finalKm === "" ? 0 : Number(finalKm);
    const totalEffectivePatients = praemienWorkdayUiActive
        ? calculateEffectivePatients(trips, assignedDay.date)
        : 0;

    const ensureValidFinalKm = (): boolean => {
        if (finalKm === "" || isNaN(Number(finalKm))) {
            toastT.warn(["toasts.workday.partial.finalKmRequired"]);
            return false;
        }
        if (Number(finalKm) < parsedInitialKm) {
            toastT.warn(["toasts.workday.finalKmLessThanInitial"]);
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (isSending) return;

        if (!report.trim()) {
            toastT.warn(["toasts.workday.partial.reportRequired"]);
            return;
        }
        if (!ensureValidFinalKm()) return;

        setIsSending(true);
        try {
            await onSend(report.trim(), parsedFinalKm, totalEffectivePatients, issueData);
        } finally {
            setIsSending(false);
        }
    };


    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-5xl overflow-y-auto max-h-[90vh] space-y-6">
                <h2 className="text-xl font-bold text-center">
                    {t("pages.workday.partial.title")}
                </h2>

                <ReviewSummary
                    assignedDay={assignedDay}
                    ambulanceNumber={ambulanceNumber}
                    initialKm={parsedInitialKm}
                    finalKm={parsedFinalKm}
                    trips={trips}
                    dense
                    showPraemieColumn={praemienWorkdayUiActive}
                />

                {praemienWorkdayUiActive && (
                    <p className="text-center font-semibold text-green-700">
                        {t("pages.workday.partial.totalPatients", {
                            count: totalEffectivePatients,
                        })}
                    </p>
                )}

                <textarea
                    placeholder={t("pages.workday.partial.placeholders.report") as string}
                    value={report}
                    onChange={(e) => setReport(e.target.value)}
                    className="w-full h-24 border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-200"
                />

                <input
                    type="number"
                    placeholder={
                        t("pages.workday.partial.placeholders.finalKm") as string
                    }
                    value={finalKm}
                    onChange={(e) =>
                        setFinalKm(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-200"
                />

                {/* Botón Avería (solo módulo mechanics) */}
                {mechanicsModuleOn && (
                <div className="pt-1 flex justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            if (!ensureValidFinalKm()) return;
                            const next = !hasIssue;
                            setHasIssue(next);
                            if (!next) {
                                setIssueData(null);
                                return;
                            }
                            setShowIssueModal(true);
                        }}
                        className={[
                            "inline-flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm font-medium transition-colors",
                            hasIssue
                                ? "border-rose-600 bg-rose-100 text-rose-800 hover:bg-rose-200"
                                : "border-slate-300 bg-white text-slate-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700",
                        ].join(" ")}
                    >
                        ️ {t("pages.workday.partial.issue.button")}
                    </button>
                </div>
                )}

                {/* Modal técnico */}
                {mechanicsModuleOn && showIssueModal && (
                    <IssueReportModal
                        isOpen={true}
                        onClose={() => {
                            setShowIssueModal(false);
                            setHasIssue(false);
                            setIssueData(null);
                        }}
                        assignedDay={assignedDay}
                        ambulanceId={ambulanceId}
                        ambulanceNumber={ambulanceNumber}
                        finalKm={parsedFinalKm}
                        onSubmit={(data) => {
                            setIssueData(data);
                            setShowIssueModal(false);
                            toastT.info(["toasts.workday.partial.issueRegistered"]);
                        }}
                    />
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-lg shadow-sm"
                    >
                        {t("pages.workday.partial.actions.cancel")}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSending}
                        className={[
                            "px-4 py-2 rounded-lg shadow-sm",
                            isSending
                                ? "bg-orange-300 text-white cursor-not-allowed"
                                : "bg-orange-500 text-white hover:bg-orange-600",
                        ].join(" ")}
                    >
                        {isSending
                            ? (t("common.sending", "Enviando...") as string)
                            : t("pages.workday.partial.actions.sendToAdmin")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PartialReviewModal;
