// src/components/workday/IssueReportModal.tsx
import React, { useEffect, useState } from "react";
import { reportIssue } from "../domain/api";
import { toastT } from "../../../utils/toast";
import type { AssignedDayFull } from "../../../modules/diensts";
import { formatYYYYMMDDToDDMMYYYY } from "../../../utils/timeUtils";
import { useTranslation } from "react-i18next";
import { notifyAdminIssuesChanged } from "../hooks/useAdminIssuesOpenCount";

const MAX_PHOTOS = 5;
const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

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
        finalKm > 0 ? finalKm.toString() : "",
    );
    const [manualAmbulanceNumber, setManualAmbulanceNumber] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [photos, setPhotos] = useState<File[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        setManualAmbulanceNumber("");
        setDescription("");
        setFinalKmInput(finalKm > 0 ? finalKm.toString() : "");
        setPhotos([]);
    }, [isOpen, assignedDay.assignmentId, finalKm]);

    if (!isOpen) return null;

    const handleSend = async () => {
        if (isSending) return;
        setIsSending(true);

        const effectiveAmbulanceNumber = (
            ambulanceNumber.trim() ||
            manualAmbulanceNumber.trim()
        ).trim();

        if (!effectiveAmbulanceNumber) {
            toastT.warn(["toasts.mechanics.missingAmbulanceIdentification"]);
            setIsSending(false);
            return;
        }

        if (!description.trim()) {
            toastT.warn(["toasts.mechanics.missingDescription"]);
            setIsSending(false);
            return;
        }

        if (!finalKmInput.trim() || isNaN(Number(finalKmInput))) {
            toastT.warn(["toasts.mechanics.invalidFinalKm"]);
            setIsSending(false);
            return;
        }

        const finalKmValue = Number(finalKmInput);
        const validAmbulanceId =
            typeof ambulanceId === "string" &&
            ambulanceId.length === 24 &&
            /^[0-9a-fA-F]{24}$/.test(ambulanceId)
                ? ambulanceId
                : undefined;

        const payload = {
            assignmentId: assignedDay.assignmentId,
            dienstNumber: assignedDay.dienstNumber!,
            date: assignedDay.date,
            startTime: assignedDay.startTime,
            endTime: assignedDay.endTime,
            team: `${assignedDay.driver.lastName}, ${assignedDay.driver.name} + ${assignedDay.medic.lastName}, ${assignedDay.medic.name}`,
            ambulanceNumber: effectiveAmbulanceNumber,
            finalKm: finalKmValue,
            timestamp: new Date().toISOString(),
            issueText: description.trim(),
            driver: assignedDay.driver._id,
            medic: assignedDay.medic._id,
            ...(validAmbulanceId ? { ambulanceId: validAmbulanceId } : {}),
        };

        try {
            await reportIssue(payload, photos.length > 0 ? photos : undefined);

            notifyAdminIssuesChanged();
            toastT.success(["toasts.mechanics.reportSent"]);
            onSubmit({ issueText: description.trim() });
            onClose();
            setIsSending(false);
        } catch (err) {
            console.error("Error al reportar avería:", err);
            toastT.error(["toasts.mechanics.reportError"]);
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-center text-lg font-semibold text-slate-900">
                        {t("pages.mechanics.issueModal.title")}
                    </h2>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                    {/* Equipo y fecha/ambulancia en dos columnas */}
                    <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-700">
                            {/* Columna izquierda: conductor y sanitario */}
                            <div className="space-y-1">
                                <p>
                                    <strong className="text-slate-800">
                                        {t("pages.mechanics.issueModal.driver")}
                                    </strong>{" "}
                                    {assignedDay.driver.lastName}, {assignedDay.driver.name}
                                </p>
                                <p>
                                    <strong className="text-slate-800">
                                        {t("pages.mechanics.issueModal.medic")}
                                    </strong>{" "}
                                    {assignedDay.medic.lastName}, {assignedDay.medic.name}
                                </p>
                            </div>

                            {/* Columna derecha: fecha */}
                            <div className="space-y-1 sm:text-right">
                                <p>
                                    <strong className="text-slate-800">
                                        {t("pages.mechanics.issueModal.date")}
                                    </strong>{" "}
                                    {formatYYYYMMDDToDDMMYYYY(assignedDay.date)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Número de ambulancia (mismo patrón de título que KM finales) */}
                    <div>
                        <label
                            htmlFor="mechanics-issue-ambulance-number"
                            className="block text-sm font-medium text-slate-800 mb-1"
                        >
                            {t("pages.mechanics.issueModal.ambulanceNumberLabel")}
                        </label>
                        {ambulanceNumber.trim() ? (
                            <input
                                id="mechanics-issue-ambulance-number"
                                readOnly
                                type="text"
                                value={ambulanceNumber.trim()}
                                className="w-full cursor-default rounded-md border border-slate-300 bg-slate-100/80 px-3 py-2 text-sm text-slate-800 outline-none"
                            />
                        ) : (
                            <input
                                id="mechanics-issue-ambulance-number"
                                type="text"
                                value={manualAmbulanceNumber}
                                onChange={(e) => setManualAmbulanceNumber(e.target.value)}
                                placeholder={t(
                                    "pages.mechanics.issueModal.manualAmbulancePlaceholder",
                                )}
                                className="w-full rounded-md border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-blue-200"
                            />
                        )}
                    </div>

                    {/* Kilometraje final */}
                    <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1">
                            {t("pages.mechanics.issueModal.finalKmLabel")}
                        </label>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={finalKmInput}
                            onChange={(e) =>
                                setFinalKmInput(e.target.value.replace(/\D/g, ""))
                            }
                            placeholder={t("pages.mechanics.issueModal.finalKmPlaceholder")}
                            className="w-full rounded-md border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-blue-200"
                        />
                    </div>

                    {/* Descripción */}
                    <textarea
                        placeholder={t("pages.mechanics.issueModal.descriptionPlaceholder")}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full h-32 rounded-md border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-blue-200"
                    />

                    <div>
                        <label
                            htmlFor="mechanics-issue-photos"
                            className="block text-sm font-medium text-slate-800 mb-1"
                        >
                            {t("pages.mechanics.issueModal.photosLabel")}
                        </label>
                        <p className="text-xs text-slate-500 mb-2">
                            {t("pages.mechanics.issueModal.photosHint")}
                        </p>
                        <input
                            id="mechanics-issue-photos"
                            type="file"
                            accept={PHOTO_ACCEPT}
                            multiple
                            disabled={isSending}
                            onChange={(e) => {
                                const list = e.target.files
                                    ? Array.from(e.target.files).slice(0, MAX_PHOTOS)
                                    : [];
                                setPhotos(list);
                                e.target.value = "";
                            }}
                            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
                        />
                        {photos.length > 0 ? (
                            <p className="mt-1 text-xs text-slate-600">
                                {t("pages.mechanics.issueModal.photosCount", {
                                    count: photos.length,
                                })}
                            </p>
                        ) : null}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={isSending}
                        className={[
                            "px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700",
                            isSending ? "cursor-not-allowed opacity-60" : "hover:bg-slate-50",
                        ].join(" ")}
                    >
                        {t("pages.mechanics.issueModal.actions.cancel")}
                    </button>

                    <button
                        onClick={handleSend}
                        disabled={isSending}
                        className={[
                            "px-4 py-2 rounded-lg text-white",
                            isSending
                                ? "bg-rose-300 cursor-not-allowed"
                                : "bg-rose-600 hover:bg-rose-700",
                        ].join(" ")}
                    >
                        {isSending
                            ? (t("common.sending", "Enviando...") as string)
                            : t("pages.mechanics.issueModal.actions.send")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IssueReportModal;
