//src/components/workday/FinalReviewModal.tsx
import React, { useState } from "react";
import { toastT } from "../../utils/toast";
import ReviewSummary from "./ReviewSummary";
import type { Trip } from "../../types/trip";
import type { AssignedDayFull } from "../../types/dienst";
import { calculateEffectivePatients } from "../../utils/prämienUtils";
import IssueReportModal from "./IssueReportModal";
import { useTranslation } from "react-i18next";

interface FinalReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    note: string,
    finalKm: number,
    issueData?: any
  ) => void;
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
    finalKm === "" ? "" : Number(finalKm)
  );
  const [hasIssue, setHasIssue] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);

  const parsedInitialKm = Number(initialKm);
  const parsedFinalKm = finalKmLocal === "" ? 0 : Number(finalKmLocal);
  const totalEffectivePatients = calculateEffectivePatients(trips, assignedDay.date);

  if (!isOpen) return null;

  const handleSend = () => {
    if (finalKmLocal === "" || isNaN(Number(finalKmLocal))) {
      toastT.warn(["toasts.workday.final.finalKmRequired"]);
      return;
    }
    onConfirm(note.trim(), parsedFinalKm);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl overflow-y-auto max-h-[90vh] space-y-6">
        <h2 className="text-xl font-bold text-center">
          {t("pages.workday.final.title")}
        </h2>

        <ReviewSummary
          assignedDay={assignedDay}
          ambulanceNumber={ambulanceNumber ?? t("pages.workday.common.unknownAmbulance")}
          initialKm={parsedInitialKm}
          finalKm={parsedFinalKm}
          trips={trips}
        />

        <p className="text-center font-semibold text-green-700">
          {t("pages.workday.final.totalPatients", { count: totalEffectivePatients })}
        </p>

        <textarea
          placeholder={t("pages.workday.final.placeholders.note") as string}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full h-24 border rounded p-2"
        />

        <input
          type="number"
          placeholder={t("pages.workday.final.placeholders.finalKm") as string}
          value={finalKmLocal}
          onChange={(e) =>
            setFinalKmLocal(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="w-full border rounded p-2 mt-2"
        />

        {/* Botón Avería */}
        <button
          type="button"
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 font-medium transition-colors duration-200
            ${
              hasIssue
                ? "border-red-600 bg-red-200 text-red-800 hover:bg-red-500 hover:text-white"
                : "border-gray-400 bg-white text-gray-700 hover:bg-red-100 hover:border-red-400 hover:text-red-700"
            }`}
          onClick={() => {
            const checked = !hasIssue;
            setHasIssue(checked);
            if (checked) setShowIssueModal(true);
          }}
        >
          ⚠️ <span>{t("pages.workday.final.issue.button")}</span>
        </button>

        {/* Modal técnico */}
        {showIssueModal && (
          <IssueReportModal
            isOpen={true}
            onClose={() => {
              setShowIssueModal(false);
              setHasIssue(false);
            }}
            assignedDay={assignedDay}
            ambulanceId={ambulanceId}
            ambulanceNumber={ambulanceNumber}
            finalKm={parsedFinalKm}
            onSubmit={(issueData: { issueText: string }) => {
              setHasIssue(true);
              setShowIssueModal(false);
              // Se envía inmediatamente con una nota por defecto de "Avería"
              onConfirm(t("pages.workday.final.issue.autoNote"), parsedFinalKm, issueData);
            }}
          />
        )}

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
          >
            {t("pages.workday.final.actions.cancel")}
          </button>

          <button
            onClick={handleSend}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded"
          >
            {t("pages.workday.final.actions.sendToAdmin")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalReviewModal;


