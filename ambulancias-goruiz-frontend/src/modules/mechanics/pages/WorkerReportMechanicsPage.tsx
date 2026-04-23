import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../hooks/useAuth";
import { useModules } from "../../../hooks/useModules";
import { MODULE_KEYS } from "../../../constants/modules";
import { todayBerlinDayKey } from "../../../utils/dates/dayKey";
import { formatYYYYMMDDToDDMMYYYY } from "../../../utils/timeUtils";
import { useWorkdayAssignment } from "../../workday/hooks/useWorkdayAssignment";
import { loadAmbulanceData } from "../../workday/utils/workdayKey";
import { normalizeAmbulanceIdToString } from "../../diensts";
import type { AssignedDayFull } from "../../diensts";
import { getAllAmbulances } from "../../ambulances/domain/api";
import type { Ambulance } from "../../ambulances/domain/types";
import IssueReportModal from "../components/IssueReportModal";

function ambulanceNumberFromAssignedDay(d: AssignedDayFull): string {
  if (d.ambulanceNumber?.trim()) return d.ambulanceNumber;
  if (d.ambulanceId && typeof d.ambulanceId === "object") {
    return (d.ambulanceId as Ambulance).ambulanceNumber ?? "";
  }
  return "";
}

const WorkerReportMechanicsPage = () => {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { hasModule } = useModules();
  const ambulancesModuleOn = hasModule(MODULE_KEYS.AMBULANCES);
  const today = todayBerlinDayKey();

  const { assignedDay, refreshAssignedDay } = useWorkdayAssignment({
    token,
    userId: user?._id,
    today,
  });

  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [ambulanceId, setAmbulanceId] = useState("");
  const [ambulanceNumber, setAmbulanceNumber] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!ambulancesModuleOn) {
      setAmbulances([]);
      return;
    }
    const run = async () => {
      try {
        if (!token) return;
        const data = await getAllAmbulances();
        setAmbulances(data);
      } catch (e) {
        console.error(e);
      }
    };
    void run();
  }, [token, ambulancesModuleOn]);

  useEffect(() => {
    if (!assignedDay) {
      setAmbulanceId("");
      setAmbulanceNumber("");
      return;
    }

    if (ambulancesModuleOn && ambulances.length === 0) {
      const idEarly = normalizeAmbulanceIdToString(assignedDay.ambulanceId);
      const numEarly = ambulanceNumberFromAssignedDay(assignedDay);
      if (idEarly) setAmbulanceId(idEarly);
      setAmbulanceNumber(numEarly || "");
      return;
    }

    const loaded = loadAmbulanceData(assignedDay.assignmentId);
    if (loaded) {
      setAmbulanceId(loaded.ambulanceId);
      if (loaded.ambulanceNumber) {
        setAmbulanceNumber(loaded.ambulanceNumber);
      } else if (ambulancesModuleOn) {
        const amb = ambulances.find((a) => a._id === loaded.ambulanceId);
        setAmbulanceNumber(amb?.ambulanceNumber || "");
      } else if (
        normalizeAmbulanceIdToString(assignedDay.ambulanceId) ===
        loaded.ambulanceId
      ) {
        const n = ambulanceNumberFromAssignedDay(assignedDay);
        setAmbulanceNumber(n || "");
      } else {
        setAmbulanceNumber("");
      }
    } else {
      const id = normalizeAmbulanceIdToString(assignedDay.ambulanceId);
      const num = ambulanceNumberFromAssignedDay(assignedDay);
      if (id) setAmbulanceId(id);
      setAmbulanceNumber(num || "");
      if (ambulancesModuleOn && id && !num) {
        const amb = ambulances.find((a) => a._id === id);
        if (amb?.ambulanceNumber) setAmbulanceNumber(amb.ambulanceNumber);
      }
      if (ambulancesModuleOn && !id && num) {
        const amb = ambulances.find((a) => a.ambulanceNumber === num);
        if (amb?._id) setAmbulanceId(amb._id);
      }
    }
  }, [assignedDay, ambulances, ambulancesModuleOn]);

  const ambulanceLine =
    ambulanceNumber.trim() ||
    (ambulanceId.length === 24
      ? t("pages.mechanics.workerReport.ambulanceFromRoster")
      : t("pages.mechanics.issueModal.unknownAmbulance"));

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900">
            {t("pages.mechanics.workerReport.title")}
          </h1>
          <Link
            to="/worker"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {t("pages.mechanics.workerReport.back")}
          </Link>
        </div>

        <p className="text-sm text-slate-600">
          {t("pages.mechanics.workerReport.intro")}
        </p>

        {!assignedDay ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="mb-2">{t("pages.mechanics.workerReport.noAssignment")}</p>
            <Link
              to="/dienst"
              className="font-medium text-amber-950 underline hover:no-underline"
            >
              {t("pages.mechanics.workerReport.linkDienst")}
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-800">
                {t("pages.mechanics.issueModal.date")}:
              </span>{" "}
              {formatYYYYMMDDToDDMMYYYY(assignedDay.date)}
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-800">
                {t("pages.mechanics.issueModal.ambulance")}:
              </span>{" "}
              {ambulanceLine}
            </p>
            <p className="text-xs text-slate-500">
              {t("pages.mechanics.workerReport.hintManualVehicle")}
            </p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-rose-700"
            >
              {t("pages.mechanics.workerReport.openForm")}
            </button>
            <button
              type="button"
              onClick={() => void refreshAssignedDay()}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-700"
            >
              {t("pages.mechanics.workerReport.refresh")}
            </button>
          </div>
        )}

        {showModal && assignedDay && (
          <IssueReportModal
            isOpen={true}
            onClose={() => setShowModal(false)}
            assignedDay={assignedDay}
            ambulanceId={ambulanceId}
            ambulanceNumber={ambulanceNumber}
            finalKm={0}
            onSubmit={() => {
              setShowModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default WorkerReportMechanicsPage;
