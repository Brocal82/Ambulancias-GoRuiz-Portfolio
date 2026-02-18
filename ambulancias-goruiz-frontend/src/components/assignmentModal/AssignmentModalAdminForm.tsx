import React from "react";
import AmbulanceDropdown from "./AmbulanceDropdown";

type Props = {
    startTime: string;
    endTime: string;
    setStartTime: React.Dispatch<React.SetStateAction<string>>;
    setEndTime: React.Dispatch<React.SetStateAction<string>>;
    ambulanceId: string;
    setAmbulanceId: React.Dispatch<React.SetStateAction<string>>;
    ambulances: any[];
    ambulanceBtnId: string;
    openAmbulanceList: boolean;
    setOpenAmbulanceList: React.Dispatch<React.SetStateAction<boolean>>;
    t: any;
    children?: React.ReactNode;
};

const AssignmentModalAdminForm: React.FC<Props> = ({
    startTime,
    endTime,
    setStartTime,
    setEndTime,
    ambulanceId,
    setAmbulanceId,
    ambulances,
    ambulanceBtnId,
    openAmbulanceList,
    setOpenAmbulanceList,
    t,
    children,
}) => {
    return (
        <>
            {/* Row 1: startTime | endTime | ambulance */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {/* Hora inicio */}
                <div className="space-y-1">
                    <label
                        htmlFor="startTime"
                        className="block text-sm font-medium text-slate-700"
                    >
                        {t("pages.assignmentModal.labels.startTime")}
                    </label>
                    <input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                    />
                </div>

                {/* Hora fin */}
                <div className="space-y-1">
                    <label
                        htmlFor="endTime"
                        className="block text-sm font-medium text-slate-700"
                    >
                        {t("pages.assignmentModal.labels.endTime")}
                    </label>
                    <input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                    />
                </div>

                {/* Ambulancia */}
                <div className="space-y-1">
                    <AmbulanceDropdown
                        label={t("pages.assignmentModal.labels.ambulance")}
                        buttonId={ambulanceBtnId}
                        isOpen={openAmbulanceList}
                        setIsOpen={setOpenAmbulanceList}
                        ambulances={ambulances}
                        selectedId={ambulanceId}
                        setSelectedId={setAmbulanceId}
                        emptyLabel={t("common.empty", "No hay resultados")}
                        placeholderLabel={t(
                            "pages.assignmentModal.placeholders.selectAmbulance",
                            "Selecciona ambulancia"
                        )}
                        unassignedLabel={t("common.none", "Ninguno")}
                    />
                </div>
            </div>

            {children}
        </>
    );
};

export default AssignmentModalAdminForm;
