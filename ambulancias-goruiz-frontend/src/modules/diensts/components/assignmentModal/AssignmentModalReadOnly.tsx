import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { FlexibleAssignment } from "../../domain/types/flexibleAssignment";

import { toUserRefOrNull } from "../../assignments";
import { formatAmbulanceLabel, formatPersonLabel } from "../../utils";

type Props = {
    assignment?: FlexibleAssignment;
    startTime: string;
    endTime: string;
};

const AssignmentModalReadOnly: React.FC<Props> = ({ assignment, startTime, endTime }) => {
    const { t } = useTranslation();

    const driver = useMemo(() => toUserRefOrNull(assignment?.driver) ?? undefined, [assignment]);
    const medic = useMemo(() => toUserRefOrNull(assignment?.medic) ?? undefined, [assignment]);

    if (!assignment) {
        return (
            <p className="text-emerald-700 font-semibold text-center text-base">
                {t("pages.assignmentModal.info.dayOff")}
            </p>
        );
    }

    return (
        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
            <p className="text-sm text-slate-700">
                🕒 {startTime} - {endTime}
            </p>

            <p className="text-sm text-slate-700">
                {t("pages.assignmentModal.readOnly.ambulance")} {formatAmbulanceLabel(assignment.ambulanceId)}
            </p>

            <p className="text-sm text-slate-700">
                {t("pages.assignmentModal.readOnly.driver")} {formatPersonLabel(driver)}
            </p>

            <p className="text-sm text-slate-700">
                {t("pages.assignmentModal.readOnly.medic")} {formatPersonLabel(medic)}
            </p>
        </div>
    );
};

export default AssignmentModalReadOnly;
