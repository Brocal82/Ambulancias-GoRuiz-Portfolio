import React, { useState } from "react";
import { toastT } from "../../../utils/toast";
import ReviewSummary from "./ReviewSummary";
import type { Trip } from "../../../types/trip";
import type { AssignedDayFull } from "../../../modules/diensts";
import { calculateEffectivePatients } from "../../../utils/praemien/calculateEffectivePatients";
import IssueReportModal from "./IssueReportModal";
import { useTranslation } from "react-i18next";

interface FinalReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (note: string, finalKm: number, issueData?: any) => Promise<void>;
    trips: Trip[];
    ambulanceId: string;
    ambulanceNumber: string;
    initialKm: string;
    finalKm: string;
    assignedDay: AssignedDayFull;
}

const FinalReviewModal: React.FC<FinalReviewModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    trips,
    ambulanceId,
    ambulanceNumber,
    initialKm,
    finalKm,
    assignedDay,
}) => {
    const { t } = useTranslation();

    const [note, setNote] = useState<string>("");
    const [finalKmLocal, setFinalKmLocal] = useState<number | "">(
        finalKm === "" ? "" : Number(finalKm),
    );
    const [hasIssue, setHasIssue] = useState(false);
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [issueData, setIssueData] = useState<any | null>(null); // guardamos la avería sin auto-enviar
    const [isSending, setIsSending] = useState(false);

    const parsedInitialKm = Number(initialKm);
    const parsedFinalKm = finalKmLocal === "" ? 0 : Number(finalKmLocal);
    const totalEffectivePatients = calculateEffectivePatients(
        trips,
        assignedDay.date,
    );

    if (!isOpen) return null;

    // Validación usando tus toasts existentes
    const ensureValidFinalKm = (): boolean => {
        if (finalKmLocal === "" || isNaN(Number(finalKmLocal))) {
            toastT.warn(["toasts.workday.final.finalKmRequired"]);
            return false;
        }
        if (Number(finalKmLocal) < parsedInitialKm) {
            toastT.warn(["toasts.workday.finalKmLessThanInitial"]);
            return false;
        }
        return true;
    };

    const handleSend = async () => {
        if (isSending) return;
        if (!ensureValidFinalKm()) return;

        setIsSending(true);
        try {
            await onConfirm(note.trim(), parsedFinalKm, issueData || undefined);
        } finally {
            setIsSending(false);
        }
    };


    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-5xl overflow-y-auto max-h-[90vh] space-y-6">
                <h2 className="text-xl font-bold text-center">
                    {t("pages.workday.final.title")}
                </h2>

                <ReviewSummary
                    assignedDay={assignedDay}
                    ambulanceNumber={
                        ambulanceNumber ?? t("pages.workday.common.unknownAmbulance")
                    }
                    initialKm={parsedInitialKm}
                    finalKm={parsedFinalKm}
                    trips={trips}
                    dense
                />

                <p className="text-center font-semibold text-green-700">
                    {t("pages.workday.final.totalPatients", {
                        count: totalEffectivePatients,
                    })}
                </p>

                <textarea
                    placeholder={t("pages.workday.final.placeholders.note") as string}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full h-24 border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-200"
                />

                <input
                    type="number"
                    placeholder={t("pages.workday.final.placeholders.finalKm") as string}
                    value={finalKmLocal}
                    onChange={(e) =>
                        setFinalKmLocal(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-200"
                />

                {/* Botón Avería */}
                <div className="pt-1 flex justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            if (!ensureValidFinalKm()) return;

                            const next = !hasIssue;
                            setHasIssue(next);

                            if (!next) {
                                // si desmarca, limpiamos datos de avería
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
                        ⚠️ {t("pages.workday.final.issue.button")}
                    </button>
                </div>

                {/* Modal técnico (independiente del envío del sumario) */}
                {showIssueModal && (
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
                        onSubmit={(data: { issueText: string }) => {
                            setIssueData(data);
                            setShowIssueModal(false);
                            toastT.info(["toasts.workday.final.issueRegistered"]); // reusamos toast existente
                        }}
                    />
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-lg shadow-sm"
                    >
                        {t("pages.workday.final.actions.cancel")}
                    </button>

                    <button
                        onClick={handleSend}
                        disabled={isSending}
                        className={[
                            "px-4 py-2 rounded-lg shadow-sm",
                            isSending
                                ? "bg-blue-300 text-white cursor-not-allowed"
                                : "bg-blue-600 text-white hover:bg-blue-700",
                        ].join(" ")}
                    >
                        {isSending
                            ? (t("common.sending", "Enviando...") as string)
                            : t("pages.workday.final.actions.sendToAdmin")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FinalReviewModal;
