// src/components/workday/IssueReportModal.tsx
import React, { useState } from "react";
import { toastT } from "../../utils/toast";
import type { AssignedDayFull } from "../../types/dienst";
import { formatYYYYMMDDToDDMMYYYY } from "../../utils/timeUtils";
import { useTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  assignedDay: AssignedDayFull;
  ambulanceId: string;
  ambulanceNumber: string;
  finalKm: number;
  onSubmit: (issueData: { issueText: string }) => void;
}

const IssueReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  assignedDay,
  ambulanceId,
  ambulanceNumber,
  finalKm,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [finalKmInput, setFinalKmInput] = useState<string>(
    finalKm > 0 ? finalKm.toString() : ""
  );

  if (!isOpen) return null;

  const handleSend = async () => {
    // Dejamos toasts para más tarde (i18n de toasts al final)
    if (!ambulanceId || ambulanceId.length < 24) {
      toastT.warn(["toasts.mechanics.invalidAmbulance"]);
      return;
    }

    if (!description.trim()) {
      toastT.warn(["toasts.mechanics.missingDescription"]);
      return;
    }

    if (!finalKmInput.trim() || isNaN(Number(finalKmInput))) {
      toastT.warn(["toasts.mechanics.invalidFinalKm"]);
      return;
    }

    const finalKmValue = Number(finalKmInput);

    const payload = {
      dienstNumber: assignedDay.dienstNumber!,
      date: assignedDay.date, // backend espera YYYY-MM-DD
      startTime: assignedDay.startTime,
      endTime: assignedDay.endTime,
      team: `${assignedDay.driver.lastName}, ${assignedDay.driver.name} + ${assignedDay.medic.lastName}, ${assignedDay.medic.name}`,
      ambulanceNumber: ambulanceNumber,
      ambulanceId,
      finalKm: finalKmValue,
      timestamp: new Date().toISOString(),
      issueText: description.trim(),
      driver: assignedDay.driver._id,
      medic: assignedDay.medic._id,
    };

    try {
      const res = await fetch("/api/workday-summary/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

       toastT.success(["toasts.mechanics.reportSent"]);
      onSubmit({ issueText: description.trim() });
      onClose();
    } catch (err) {
      console.error("Error al reportar avería:", err);
      toastT.error(["toasts.mechanics.reportError"]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-lg space-y-4">
        <h2 className="text-xl font-bold text-center">
          {t("pages.mechanics.issueModal.title")}
        </h2>

        <p>
          <strong>{t("pages.mechanics.issueModal.dienst", { num: assignedDay.dienstNumber })}</strong>
        </p>

        <p>
          <strong>{t("pages.mechanics.issueModal.date")}</strong>{" "}
          {formatYYYYMMDDToDDMMYYYY(assignedDay.date)}
        </p>
        <p>
          <strong>{t("pages.mechanics.issueModal.time")}</strong>{" "}
          {assignedDay.startTime} – {assignedDay.endTime}
        </p>
        <p>
          <strong>{t("pages.mechanics.issueModal.driver")}</strong>{" "}
          {assignedDay.driver.lastName}, {assignedDay.driver.name}
        </p>
        <p>
          <strong>{t("pages.mechanics.issueModal.medic")}</strong>{" "}
          {assignedDay.medic.lastName}, {assignedDay.medic.name}
        </p>
        <p>
          <strong>{t("pages.mechanics.issueModal.ambulance")}</strong>{" "}
          {ambulanceNumber || t("pages.mechanics.issueModal.unknownAmbulance")}
        </p>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t("pages.mechanics.issueModal.finalKmLabel")}
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={finalKmInput}
            onChange={(e) => setFinalKmInput(e.target.value.replace(/\D/g, ""))}
            placeholder={t("pages.mechanics.issueModal.finalKmPlaceholder")}
            className="w-full border rounded p-2"
          />
        </div>

        <p>
          <strong>{t("pages.mechanics.issueModal.timestamp")}</strong>{" "}
          {new Date().toLocaleString()}
        </p>

        <textarea
          placeholder={t("pages.mechanics.issueModal.descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full h-32 border rounded p-2"
        />

        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            {t("pages.mechanics.issueModal.actions.cancel")}
          </button>
          <button onClick={handleSend} className="px-4 py-2 bg-red-600 text-white rounded">
            {t("pages.mechanics.issueModal.actions.send")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IssueReportModal;

