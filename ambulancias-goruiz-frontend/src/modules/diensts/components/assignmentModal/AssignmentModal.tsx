// frontend/src/modules/diensts/components/assignmentModal/AssignmentModal.tsx
import { useState, useEffect, useId, useMemo } from "react";

import { useAuth } from "../../../../hooks/useAuth";

import { updateDienstPartial, removeAssignment } from "../../domain/api";
import { emitDienstsChanged } from "../../utils/dienstEvents";
import type { UserRef } from "../../domain/types";

import { toastT } from "../../../../utils/toast";

import { driverExpired } from "./utils";
import {
    getUserFlagsMeta,
    getNameClass,
    getNameTitle,
} from "./presenters";

import AssignmentModalReadOnly from "./AssignmentModalReadOnly";
import AssignmentModalAdminForm from "./AssignmentModalAdminForm";

import { useAvailableUsersForAssignment } from "./hooks/useAvailableUsersForAssignment";
import { useAmbulances } from "./hooks/useAmbulances";
import { useDayFlags } from "./hooks/useDayFlags";

import { buildUpdateAssignment } from "./buildUpdateAssignment";

import type { FlexibleAssignment } from "../../domain/types/flexibleAssignment";

import { useTranslation } from "react-i18next";

import {
    normalizeAmbulanceIdToString,
    toUserRefOrNull,
} from "../../assignments";

import { formatPersonLabel } from "../../utils";

import { validateAssignmentSave } from "./validation";

import { formatYYYYMMDDToDDMMYYYY } from "../../../../utils/timeUtils";

interface AssignmentModalProps {
    isOpen: boolean;
    date: string; // 'YYYY-MM-DD'
    assignment?: FlexibleAssignment; // ✅ tipo estable para el modal
    dienstId: string;
    onClose: () => void;
    onUpdate: () => void;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({
    isOpen,
    date,
    assignment,
    dienstId,
    onClose,
    onUpdate,
}) => {
    const { role: userRole, token } = useAuth();
    const isAdmin = userRole === "admin";
    const { t, i18n } = useTranslation();


    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [ambulanceId, setAmbulanceId] = useState("");
    const { ambulances } = useAmbulances({ token });
    const [selectedDriverId, setSelectedDriverId] = useState("");
    const [selectedMedicId, setSelectedMedicId] = useState("");
    const { availableDrivers, availableMedics } = useAvailableUsersForAssignment({
        token,
        isAdmin,
        date,
        assignment,
        startTime,
        endTime,
        selectedDriverId,
        selectedMedicId,
    });
    const userIdsForFlags = useMemo(() => {
        const ids = new Set<string>();
        for (const u of availableDrivers) if (u?._id) ids.add(u._id);
        for (const u of availableMedics) if (u?._id) ids.add(u._id);
        if (selectedDriverId) ids.add(selectedDriverId);
        if (selectedMedicId) ids.add(selectedMedicId);
        return Array.from(ids);
    }, [availableDrivers, availableMedics, selectedDriverId, selectedMedicId]);

    const { vacationFlags, sickFlags, flagsLoading } = useDayFlags({
        isOpen,
        token,
        date,
        userIds: userIdsForFlags,
    });

    const [isLoading, setIsLoading] = useState(false);

    // Dropdowns
    const [openDriverList, setOpenDriverList] = useState(false);
    const [openMedicList, setOpenMedicList] = useState(false);
    const [openAmbulanceList, setOpenAmbulanceList] = useState(false);

    // IDs accesibilidad
    const driverBtnId = useId();
    const medicBtnId = useId();
    const ambulanceBtnId = useId();

    const dayLabel = useMemo(() => {
        // date viene en formato YYYY-MM-DD
        const d = new Date(`${date}T00:00:00`);

        // Map básico de i18n.language a locale para toLocaleDateString
        // Ajusta o extiende si soportas otros códigos regionales.
        const localeMap: Record<string, string> = {
            es: "es-ES",
            en: "en-US",
            de: "de-DE",
        };
        const lang = (i18n?.language as string) || "es";
        const locale = localeMap[lang.split("-")[0]] ?? localeMap[lang] ?? "es-ES";

        const dayName = d.toLocaleDateString(locale, { weekday: "long" });

        const prettyDate = formatYYYYMMDDToDDMMYYYY(date);

        // Capitalizamos la primera letra conservando el resto igual
        const capitalizedDay =
            dayName.length > 0 ? `${dayName.charAt(0).toUpperCase()}${dayName.slice(1)}` : dayName;

        return `${capitalizedDay} · ${prettyDate}`;
    }, [date, i18n?.language]);




    // Precarga del assignment
    useEffect(() => {
        if (!assignment) return;

        setStartTime(assignment.startTime || "");
        setEndTime(assignment.endTime || "");

        setAmbulanceId(normalizeAmbulanceIdToString(assignment.ambulanceId));

        setSelectedDriverId(
            typeof assignment.driver === "string"
                ? assignment.driver
                : assignment.driver?._id || "",
        );
        setSelectedMedicId(
            typeof assignment.medic === "string"
                ? assignment.medic
                : assignment.medic?._id || "",
        );
    }, [assignment]);


    if (!isOpen) return null;

    // Guardado
    const handleSave = async () => {
        if (!token) return;

        const validation = validateAssignmentSave({
            dienstId,
            startTime,
            endTime,
            selectedDriverId,
            selectedMedicId,
            sickFlags,
            vacationFlags,
        });

        if (validation) {
            if (validation.type === "error") toastT.error([validation.key]);
            else toastT.warn([validation.key]);
            return;
        }

        try {
            const updatedAssignment = buildUpdateAssignment({
                date,
                startTime,
                endTime,
                selectedDriverId,
                selectedMedicId,
                ambulanceId,
                assignment,
            });

            await updateDienstPartial(dienstId, { assignments: [updatedAssignment] }, token);
            emitDienstsChanged();
            toastT.success(["toasts.assignments.saveSuccess"]);
            onClose();
            onUpdate();
        } catch (error) {
            console.error("Error al guardar cambios:", error);
            toastT.error(["toasts.assignments.saveError"]);
        }
    };

    // Borrado
    const handleDelete = async () => {
        if (!token || !assignment) return;
        const confirmed = confirm(t("pages.assignmentModal.confirm.delete"));
        if (!confirmed) return;

        setIsLoading(true);
        try {
            await removeAssignment(dienstId, assignment.date, token);
            emitDienstsChanged();
            toastT.success(["toasts.assignments.deleteSuccess"]);
            onClose();
            onUpdate();
        } catch (error) {
            console.error("Error al eliminar assignment:", error);
            toastT.error(["toasts.assignments.deleteError"]);
        } finally {
            setIsLoading(false);
        }
    };


    const selectedDriver = useMemo(() => {
        const bySelected = availableDrivers.find((u) => u._id === selectedDriverId);
        if (bySelected) return bySelected;

        const fromAssignment = toUserRefOrNull(assignment?.driver);
        if (fromAssignment) {
            return availableDrivers.find((u) => u._id === fromAssignment._id) ?? fromAssignment;
        }
        return null;
    }, [availableDrivers, selectedDriverId, assignment]);

    const selectedMedic = useMemo(() => {
        const bySelected = availableMedics.find((u) => u._id === selectedMedicId);
        if (bySelected) return bySelected;

        const fromAssignment = toUserRefOrNull(assignment?.medic);
        if (fromAssignment) {
            return availableMedics.find((u) => u._id === fromAssignment._id) ?? fromAssignment;
        }
        return null;
    }, [availableMedics, selectedMedicId, assignment]);

    const renderUserSelected = (params: {
        selectedId: string;
        placeholder: string;
        user: UserRef | null;
        isDriver?: boolean;
    }) => {
        const { selectedId, placeholder, user, isDriver } = params;

        if (selectedId === "" || !user) return placeholder;

        const label = formatPersonLabel(user);
        const { vac, sick } = getUserFlagsMeta(user, { vacationFlags, sickFlags }, t);

        return (
            <>
                <span
                    className={getNameClass({
                        user,
                        isDriver,
                        dim: vac.has || sick.has,
                    })}
                    title={getNameTitle({ user, isDriver, t })}
                >
                    {label}
                </span>

                {vac.has && (
                    <span className="ml-1 align-middle text-slate-400" title={vac.title}>
                        🏖️
                    </span>
                )}
                {sick.has && (
                    <span className="ml-1 align-middle text-slate-500" title={sick.title}>
                        🤒
                    </span>
                )}
            </>
        );

    };

    const renderUserOption = (params: { user: UserRef; isDriver?: boolean }) => {
        const { user, isDriver } = params;

        const { vac, sick } = getUserFlagsMeta(user, { vacationFlags, sickFlags }, t);
        const dim = vac.has || sick.has;

        return (
            <>
                <span
                    className={getNameClass({ user, isDriver, dim })}
                    title={getNameTitle({ user, isDriver, t })}
                >
                    {formatPersonLabel(user)}
                </span>

                {vac.has && (
                    <span className="ml-1 align-middle text-slate-400" title={vac.title}>
                        🏖️
                    </span>
                )}
                {sick.has && (
                    <span className="ml-1 align-middle text-slate-500" title={sick.title}>
                        🤒
                    </span>
                )}
            </>
        );
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />

            <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">

                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 leading-tight">
                            {dayLabel}
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        aria-label={t("pages.assignmentModal.buttons.close", "Cerrar")}
                        className="
    -mt-1 inline-flex items-center justify-center
    w-9 h-9 rounded-full
    text-rose-600
    hover:bg-rose-50
    hover:text-rose-700
    focus:outline-none focus:ring-4 focus:ring-rose-200
    active:scale-95
    transition
    disabled:opacity-50
  "
                        title={t("pages.assignmentModal.buttons.close", "Cerrar")}
                    >
                        <span className="text-xl leading-none">×</span>
                    </button>

                </div>


                <div className="space-y-4">
                    {isAdmin ? (
                        <AssignmentModalAdminForm
                            // Row 1
                            startTime={startTime}
                            endTime={endTime}
                            setStartTime={setStartTime}
                            setEndTime={setEndTime}
                            ambulanceId={ambulanceId}
                            setAmbulanceId={setAmbulanceId}
                            ambulances={ambulances}
                            ambulanceBtnId={ambulanceBtnId}
                            openAmbulanceList={openAmbulanceList}
                            setOpenAmbulanceList={setOpenAmbulanceList}

                            // Row 2 - Driver
                            selectedDriver={selectedDriver}
                            selectedDriverId={selectedDriverId}
                            setSelectedDriverId={setSelectedDriverId}
                            openDriverList={openDriverList}
                            setOpenDriverList={setOpenDriverList}
                            availableDrivers={availableDrivers}
                            driverBtnId={driverBtnId}

                            // Row 2 - Medic
                            selectedMedic={selectedMedic}
                            selectedMedicId={selectedMedicId}
                            setSelectedMedicId={setSelectedMedicId}
                            openMedicList={openMedicList}
                            setOpenMedicList={setOpenMedicList}
                            availableMedics={availableMedics}
                            medicBtnId={medicBtnId}

                            // Shared
                            t={t}
                            renderUserSelected={renderUserSelected}
                            renderUserOption={renderUserOption}

                            isDriverDisabled={(u) => {
                                const { vac, sick } = getUserFlagsMeta(u, { vacationFlags, sickFlags }, t);
                                const ineligible = driverExpired(u, date);
                                return ineligible || vac.has || sick.has;
                            }}
                            isMedicDisabled={(u) => {
                                const { vac, sick } = getUserFlagsMeta(u, { vacationFlags, sickFlags }, t);
                                return vac.has || sick.has;
                            }}
                            sortDrivers={(a, b) => {
                                const da = driverExpired(a, date) ? 1 : 0;
                                const db = driverExpired(b, date) ? 1 : 0;
                                if (da !== db) return da - db;

                                const ka = `${a.lastName || ""} ${a.name || ""}`.toLowerCase();
                                const kb = `${b.lastName || ""} ${b.name || ""}`.toLowerCase();
                                return ka.localeCompare(kb, "es");
                            }}
                            sortMedics={(a, b) => {
                                const ka = `${a.lastName || ""} ${a.name || ""}`.toLowerCase();
                                const kb = `${b.lastName || ""} ${b.name || ""}`.toLowerCase();
                                return ka.localeCompare(kb, "es");
                            }}

                            flagsLoading={flagsLoading}

                            handleSave={handleSave}
                            handleDelete={handleDelete}
                            onClose={onClose}
                            isLoading={isLoading}
                            hasAssignment={!!assignment}
                        >

                        </AssignmentModalAdminForm>
                    ) : (
                        <AssignmentModalReadOnly assignment={assignment} startTime={startTime} endTime={endTime} />
                    )
                    }
                </div>
            </div>
        </div>
    );


};

export default AssignmentModal;
