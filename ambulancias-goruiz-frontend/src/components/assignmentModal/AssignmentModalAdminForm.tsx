import React from "react";
import AmbulanceDropdown from "./AmbulanceDropdown";
import UserDropdown from "./UserDropdown";
import type { UserRef } from "../../modules/diensts";

type Props = {
    // Row 1
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

    // Row 2 - Driver
    selectedDriver: UserRef | null;
    selectedDriverId: string;
    setSelectedDriverId: React.Dispatch<React.SetStateAction<string>>;
    openDriverList: boolean;
    setOpenDriverList: React.Dispatch<React.SetStateAction<boolean>>;
    availableDrivers: UserRef[];
    driverBtnId: string;

    // Row 2 - Medic
    selectedMedic: UserRef | null;
    selectedMedicId: string;
    setSelectedMedicId: React.Dispatch<React.SetStateAction<string>>;
    openMedicList: boolean;
    setOpenMedicList: React.Dispatch<React.SetStateAction<boolean>>;
    availableMedics: UserRef[];
    medicBtnId: string;

    // Shared
    t: any;

    // Renderers (vienen del modal)
    renderUserSelected: (params: {
        selectedId: string;
        placeholder: string;
        user: UserRef | null;
        isDriver?: boolean;
    }) => React.ReactNode;

    renderUserOption: (params: { user: UserRef; isDriver?: boolean }) => React.ReactNode;

    // Disable + sort
    isDriverDisabled: (u: UserRef) => boolean;
    isMedicDisabled: (u: UserRef) => boolean;
    sortDrivers: (a: UserRef, b: UserRef) => number;
    sortMedics: (a: UserRef, b: UserRef) => number;

    children?: React.ReactNode;
};

const AssignmentModalAdminForm: React.FC<Props> = ({
    // Row 1
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

    // Row 2 - Driver
    selectedDriver,
    selectedDriverId,
    setSelectedDriverId,
    openDriverList,
    setOpenDriverList,
    availableDrivers,
    driverBtnId,

    // Row 2 - Medic
    selectedMedic,
    selectedMedicId,
    setSelectedMedicId,
    openMedicList,
    setOpenMedicList,
    availableMedics,
    medicBtnId,

    // Shared
    t,
    renderUserSelected,
    renderUserOption,
    isDriverDisabled,
    isMedicDisabled,
    sortDrivers,
    sortMedics,

    children,
}) => {
    return (
        <>
            {/* Row 1: startTime | endTime | ambulance */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {/* Hora inicio */}
                <div className="space-y-1">
                    <label htmlFor="startTime" className="block text-sm font-medium text-slate-700">
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
                    <label htmlFor="endTime" className="block text-sm font-medium text-slate-700">
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

            {/* Row 2: driver | medic */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 mt-4">
                {/* Conductor */}
                <div>
                    <UserDropdown
                        label={t("pages.assignmentModal.labels.driver")}
                        buttonId={driverBtnId}
                        isOpen={openDriverList}
                        setIsOpen={setOpenDriverList}
                        selectedUser={selectedDriver}
                        selectedId={selectedDriverId}
                        setSelectedId={(id) => {
                            setSelectedDriverId(id);
                            if (id && id === selectedMedicId) setSelectedMedicId("");
                        }}
                        otherSelectedId={selectedMedicId}
                        clearOtherIfSame
                        availableUsers={availableDrivers}
                        renderSelected={(u) =>
                            renderUserSelected({
                                selectedId: selectedDriverId,
                                placeholder: t(
                                    "pages.assignmentModal.placeholders.selectDriver",
                                    "Selecciona conductor"
                                ),
                                user: u,
                                isDriver: true,
                            })
                        }
                        renderOption={(u) => renderUserOption({ user: u, isDriver: true })}
                        sortFn={sortDrivers}
                        isDisabled={isDriverDisabled}
                        emptyLabel={t("common.empty", "No hay resultados")}
                        unassignedLabel={t("common.none", "Ninguno")}
                    />

                    <p className="mt-1 text-[11px] text-slate-500">
                        🚫{" "}
                        {t(
                            "pages.diensts.adminPage.legendCantDrive",
                            "No puede conducir, P-Schein caducado"
                        )}
                    </p>
                </div>

                {/* Sanitario */}
                <div>
                    <UserDropdown
                        label={t("pages.assignmentModal.labels.medic")}
                        buttonId={medicBtnId}
                        isOpen={openMedicList}
                        setIsOpen={setOpenMedicList}
                        selectedUser={selectedMedic}
                        selectedId={selectedMedicId}
                        setSelectedId={(id) => {
                            if (id === selectedDriverId) setSelectedDriverId("");
                            setSelectedMedicId(id);
                        }}
                        otherSelectedId={selectedDriverId}
                        clearOtherIfSame
                        availableUsers={availableMedics}
                        renderSelected={(u) =>
                            renderUserSelected({
                                selectedId: selectedMedicId,
                                placeholder: t(
                                    "pages.assignmentModal.placeholders.selectMedic",
                                    "Selecciona sanitario"
                                ),
                                user: u,
                                isDriver: false,
                            })
                        }
                        renderOption={(u) => renderUserOption({ user: u, isDriver: false })}
                        sortFn={sortMedics}
                        isDisabled={isMedicDisabled}
                        emptyLabel={t("common.empty", "No hay resultados")}
                        unassignedLabel={t("common.none", "Ninguno")}
                    />
                </div>
            </div>

            {children}
        </>
    );
};

export default AssignmentModalAdminForm;
