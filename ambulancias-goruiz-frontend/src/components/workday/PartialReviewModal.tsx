// frontend/src/components/workday/PartialReviewModal.tsx
import React, { useState } from "react";
import type { Trip } from "../../types/trip";
import type { AssignedDayFull } from "../../types/dienst";
import ReviewSummary from "./ReviewSummary";
import { toastT } from "../../utils/toast";
import { calculateEffectivePatients } from "../../utils/prämienUtils";
import IssueReportModal from "./IssueReportModal";
import { useTranslation } from "react-i18next";

interface Props {
  trips: Trip[];
  assignedDay: AssignedDayFull;
  ambulanceId: string;
  ambulanceNumber: string;
  initialKm: string;
  finalKm: string;
  onClose: () => void;
  onSend: (
    report: string,
    finalKm: number,
    totalEffectivePatients: number,
    issueData?: any
  ) => void;
}

const PartialReviewModal: React.FC<Props> = ({
  trips,
  assignedDay,
  ambulanceId,
  ambulanceNumber,
  initialKm,
  onClose,
  onSend,
}) => {
  const { t } = useTranslation();

  const [report, setReport] = useState("");
  const [finalKm, setFinalKm] = useState<number | "">("");
  const [hasIssue, setHasIssue] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueData, setIssueData] = useState<any | null>(null);

  const parsedInitialKm = Number(initialKm);
  const parsedFinalKm = finalKm === "" ? 0 : Number(finalKm);
  const totalEffectivePatients = calculateEffectivePatients(trips, assignedDay.date);

  const handleSubmit = () => {
    if (!report.trim()) {
      toastT.warn(["toasts.workday.partial.reportRequired"]);
      return;
    }
    if (finalKm === "" || isNaN(Number(finalKm))) {
      toastT.warn(["toasts.workday.partial.finalKmRequired"]);
      return;
    }

    onSend(report.trim(), parsedFinalKm, totalEffectivePatients, issueData);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl overflow-y-auto max-h-[90vh] space-y-6">
        <h2 className="text-xl font-bold text-center">
          {t("pages.workday.partial.title")}
        </h2>

        <ReviewSummary
          assignedDay={assignedDay}
          ambulanceNumber={ambulanceNumber}
          initialKm={parsedInitialKm}
          finalKm={parsedFinalKm}
          trips={trips}
        />

        <p className="text-center font-semibold text-green-700">
          {t("pages.workday.partial.totalPatients", { count: totalEffectivePatients })}
        </p>

        <textarea
          placeholder={t("pages.workday.partial.placeholders.report") as string}
          value={report}
          onChange={(e) => setReport(e.target.value)}
          className="w-full h-24 border rounded p-2"
        />

        <input
          type="number"
          placeholder={t("pages.workday.partial.placeholders.finalKm") as string}
          value={finalKm}
          onChange={(e) =>
            setFinalKm(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="w-full border rounded p-2"
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
          ⚠️ <span>{t("pages.workday.partial.issue.button")}</span>
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
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
          >
            {t("pages.workday.partial.actions.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-orange-500 text-white hover:bg-orange-700 rounded"
          >
            {t("pages.workday.partial.actions.sendToAdmin")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartialReviewModal;






