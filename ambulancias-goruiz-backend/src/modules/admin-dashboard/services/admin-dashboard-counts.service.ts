import Company from "../../companies/models/company.model";
import { MODULE_KEYS } from "../../companies/constants/modules.constants";
import { countVacationRequestsByStatus } from "../../vacation/services/vacation-requests-read.service";
import { getSummariesCountByStatus } from "../../workday-summary/services/workday-summary.service";
import { getAppointmentsCount } from "../../appointments/services/appointments.service";
import { getIssuesCount } from "../../mechanics/services/mechanics.service";
import { countSickLeavesByStatus } from "../../sick-leaves/services/sick-leaves-read.service";
import { countPendingManualPraemieForCompany } from "../../praemien/services/praemien-manual-daily-admin.service";

export type AdminDashboardCounts = {
  vacations: number;
  summaries: number;
  appointments: number;
  mechanics: number;
  sickLeaves: number;
  praemienManual: number;
};

const ZERO_COUNTS: AdminDashboardCounts = {
  vacations: 0,
  summaries: 0,
  appointments: 0,
  mechanics: 0,
  sickLeaves: 0,
  praemienManual: 0,
};

async function loadEnabledModules(companyId: string): Promise<string[]> {
  const company = await Company.findById(companyId).select("enabledModules").lean();
  return Array.isArray(company?.enabledModules) ? company.enabledModules : [];
}

export async function getAdminDashboardCounts(
  companyId: string,
): Promise<AdminDashboardCounts> {
  const enabledModules = await loadEnabledModules(companyId);
  const has = (key: string) => enabledModules.includes(key);

  const [
    vacations,
    summaries,
    appointments,
    mechanics,
    sickLeaves,
    praemienManual,
  ] = await Promise.all([
    has(MODULE_KEYS.VACATION)
      ? countVacationRequestsByStatus("pending", companyId)
      : Promise.resolve(0),
    has(MODULE_KEYS.WORKDAY)
      ? getSummariesCountByStatus("pending", companyId).then((r) => r.count)
      : Promise.resolve(0),
    has(MODULE_KEYS.APPOINTMENTS)
      ? getAppointmentsCount("pending", companyId).then((r) => r.count)
      : Promise.resolve(0),
    has(MODULE_KEYS.MECHANICS)
      ? getIssuesCount("open", companyId).then((r) => r.count)
      : Promise.resolve(0),
    has(MODULE_KEYS.SICK_LEAVES)
      ? countSickLeavesByStatus("pending", companyId)
      : Promise.resolve(0),
    has(MODULE_KEYS.PRAEMIEN)
      ? countPendingManualPraemieForCompany(companyId)
      : Promise.resolve(0),
  ]);

  return {
    vacations,
    summaries,
    appointments,
    mechanics,
    sickLeaves,
    praemienManual,
  };
}

export { ZERO_COUNTS };
