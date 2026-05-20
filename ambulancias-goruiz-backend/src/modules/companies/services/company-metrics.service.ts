import mongoose from "mongoose";
import Company from "../models/company.model";
import User from "../../users/models/user.model";
import Dienst from "../../diensts/models/dienst.model";
import { Trip } from "../../trips/models/trip.model";
import WorkdaySummary from "../../workday-summary/models/workday-summary.model";
import VacationRequest from "../../vacation/models/vacation-request.model";
import MechanicsIssue from "../../mechanics/models/mechanics-issue.model";
import { MODULE_KEYS } from "../constants/modules.constants";
import {
  ACTIVE_COMPANY_FILTER,
  aggregateUsersByRoleForCompanies,
} from "./companies.service";

export type GlobalSuperadminMetrics = {
  generatedAt: string;
  companies: {
    total: number;
    active: number;
    inactive: number;
    needingOnboarding: number;
  };
  users: {
    active: number;
    workers: number;
    admins: number;
  };
};

export type CompanyModuleMetrics = {
  scheduling: { diensts: number } | null;
  workday: { trips: number; finalClosures: number } | null;
  vacation: { pending: number } | null;
  mechanics: { openIssues: number } | null;
};

export type CompanyMetrics = {
  companyId: string;
  generatedAt: string;
  enabledModules: string[];
  modules: CompanyModuleMetrics;
};

function parseCompanyOid(id: string): mongoose.Types.ObjectId | null {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function companyMatch(companyId: mongoose.Types.ObjectId) {
  return { companyId };
}

export async function getGlobalSuperadminMetrics(): Promise<GlobalSuperadminMetrics> {
  const companies = await Company.find(ACTIVE_COMPANY_FILTER)
    .select("_id isActive enabledModules")
    .lean();
  const companyIds = companies.map((c) => c._id as mongoose.Types.ObjectId);
  const roleMap = await aggregateUsersByRoleForCompanies(companyIds);

  let needingOnboarding = 0;
  let totalWorkers = 0;
  let totalAdmins = 0;
  let activeCompanies = 0;
  let inactiveCompanies = 0;

  for (const company of companies) {
    if (company.isActive === true) activeCompanies += 1;
    else inactiveCompanies += 1;
    const cid = company._id.toString();
    const roles = roleMap.get(cid);
    const adminCount = roles?.admin ?? 0;
    const modulesCount = Array.isArray(company.enabledModules)
      ? company.enabledModules.length
      : 0;
    if (adminCount === 0 || modulesCount === 0) needingOnboarding += 1;
    totalAdmins += adminCount;
    totalWorkers += roles?.worker ?? 0;
  }

  const activeUsers = await User.countDocuments({
    companyId: { $in: companyIds },
    isActive: true,
  });

  return {
    generatedAt: new Date().toISOString(),
    companies: {
      total: companies.length,
      active: activeCompanies,
      inactive: inactiveCompanies,
      needingOnboarding,
    },
    users: {
      active: activeUsers,
      workers: totalWorkers,
      admins: totalAdmins,
    },
  };
}

export async function getCompanyMetrics(
  companyId: string,
): Promise<CompanyMetrics | null> {
  const oid = parseCompanyOid(companyId);
  if (!oid) return null;

  const company = await Company.findOne({ _id: oid, ...ACTIVE_COMPANY_FILTER })
    .select("enabledModules")
    .lean();
  if (!company) return null;

  const enabled: string[] = Array.isArray(company.enabledModules)
    ? company.enabledModules
    : [];
  const enabledSet = new Set(enabled);
  const match = companyMatch(oid);

  const modules: CompanyModuleMetrics = {
    scheduling: null,
    workday: null,
    vacation: null,
    mechanics: null,
  };

  const tasks: Promise<void>[] = [];

  if (enabledSet.has(MODULE_KEYS.SCHEDULING)) {
    tasks.push(
      Dienst.countDocuments(match).then((diensts) => {
        modules.scheduling = { diensts };
      }),
    );
  }

  if (enabledSet.has(MODULE_KEYS.WORKDAY)) {
    tasks.push(
      Promise.all([
        Trip.countDocuments(match),
        WorkdaySummary.countDocuments({ ...match, isFinalClosure: true }),
      ]).then(([trips, finalClosures]) => {
        modules.workday = { trips, finalClosures };
      }),
    );
  }

  if (enabledSet.has(MODULE_KEYS.VACATION)) {
    tasks.push(
      VacationRequest.countDocuments({
        ...match,
        status: "pending",
      }).then((pending) => {
        modules.vacation = { pending };
      }),
    );
  }

  if (enabledSet.has(MODULE_KEYS.MECHANICS)) {
    tasks.push(
      MechanicsIssue.countDocuments({
        ...match,
        isSeen: { $ne: true },
      }).then((openIssues) => {
        modules.mechanics = { openIssues };
      }),
    );
  }

  await Promise.all(tasks);

  return {
    companyId: oid.toString(),
    generatedAt: new Date().toISOString(),
    enabledModules: enabled,
    modules,
  };
}
