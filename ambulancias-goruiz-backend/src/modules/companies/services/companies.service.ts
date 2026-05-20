import mongoose from "mongoose";
import Company from "../models/company.model";
import User from "../../users/models/user.model";
import { Team } from "../../teams/models/team.model";
import Dienst from "../../diensts/models/dienst.model";
import { MODULE_KEYS } from "../constants/modules.constants";
import type { CreateCompanyInput, UpdateCompanyInput } from "../schemas/company.schema";

/** Companies not soft-deleted (legacy rows may lack deletedAt). */
export const ACTIVE_COMPANY_FILTER = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

export type CompanyUsersByRole = {
  admin: number;
  worker: number;
  mecanico: number;
  jefe_mecanicos: number;
  jefe_logistica: number;
  total: number;
};

export type CompanyOnboardingFlags = {
  hasAdmin: boolean;
  hasWorker: boolean;
  hasModulesConfigured: boolean;
};

export type CompanySummary = {
  companyId: string;
  name: string;
  isActive: boolean;
  deletedAt: Date | null;
  emailDomain: string;
  enabledModules: string[];
  enabledModulesCount: number;
  usersByRole: CompanyUsersByRole;
  onboarding: CompanyOnboardingFlags;
};

export type CompanyUserListItem = {
  _id: string;
  name: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
};

function parseCompanyOid(id: string): mongoose.Types.ObjectId | null {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export async function aggregateUsersByRoleForCompanies(
  companyIds: mongoose.Types.ObjectId[],
): Promise<Map<string, CompanyUsersByRole>> {
  const result = new Map<string, CompanyUsersByRole>();
  if (companyIds.length === 0) return result;

  const rows = await User.aggregate<{
    _id: { companyId: mongoose.Types.ObjectId; role: string };
    count: number;
  }>([
    {
      $match: {
        companyId: { $in: companyIds },
      },
    },
    {
      $group: {
        _id: { companyId: "$companyId", role: "$role" },
        count: { $sum: 1 },
      },
    },
  ]);

  const empty = (): CompanyUsersByRole => ({
    admin: 0,
    worker: 0,
    mecanico: 0,
    jefe_mecanicos: 0,
    jefe_logistica: 0,
    total: 0,
  });

  for (const row of rows) {
    const cid = row._id.companyId.toString();
    let bucket = result.get(cid);
    if (!bucket) {
      bucket = empty();
      result.set(cid, bucket);
    }
    const role = String(row._id.role);
    const n = row.count;
    bucket.total += n;
    if (role === "admin") bucket.admin = n;
    else if (role === "worker") bucket.worker = n;
    else if (role === "mecanico") bucket.mecanico = n;
    else if (role === "jefe_mecanicos") bucket.jefe_mecanicos = n;
    else if (role === "jefe_logistica") bucket.jefe_logistica = n;
  }

  for (const cid of companyIds.map((id) => id.toString())) {
    if (!result.has(cid)) result.set(cid, empty());
  }

  return result;
}

function buildOnboardingFlags(
  usersByRole: CompanyUsersByRole,
  enabledModules: string[] | undefined,
): CompanyOnboardingFlags {
  const modules = Array.isArray(enabledModules) ? enabledModules : [];
  return {
    hasAdmin: usersByRole.admin > 0,
    hasWorker: usersByRole.worker > 0,
    hasModulesConfigured: modules.length > 0,
  };
}

/**
 * Prämien en modo **automático** lee workday-summaries: exige módulo workday.
 * Prämien **manual** (cierres en papel) puede activarse sin jornada digital.
 * Desactivar `workday` no borra datos históricos; solo se bloquean rutas
 * con `requireModule(WORKDAY)`.
 */
function assertAutomaticPraemienRequiresWorkday(
  modules: string[] | undefined,
  praemienMode: "automatic" | "manual",
): void {
  if (!modules) return;
  if (
    praemienMode === "automatic" &&
    modules.includes(MODULE_KEYS.PRAEMIEN) &&
    !modules.includes(MODULE_KEYS.WORKDAY)
  ) {
    throw new Error(
      "Prämien automático requiere el módulo de jornada y viajes (workday). Usa Prämien manual para datos en papel sin jornada digital.",
    );
  }
}

/** Al desactivar el módulo ambulancias, los equipos no deben seguir referenciando vehículos. */
async function clearTeamAmbulancesForCompany(companyId: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(companyId)) return;
  const oid = new mongoose.Types.ObjectId(companyId);
  await Team.updateMany(
    { companyId: oid, ambulanceId: { $exists: true, $ne: null } },
    { $unset: { ambulanceId: "" } },
  );
}

/** Quita ambulanceId de cada día en todos los Diensts de la empresa (planificación histórica). */
async function clearDienstAssignmentAmbulancesForCompany(companyId: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(companyId)) return;
  const oid = new mongoose.Types.ObjectId(companyId);
  const diensts = await Dienst.find({ companyId: oid });
  for (const d of diensts) {
    let changed = false;
    for (const a of d.assignments) {
      if (a.ambulanceId != null) {
        (a as { ambulanceId?: unknown }).ambulanceId = undefined;
        changed = true;
      }
    }
    if (changed) {
      d.markModified("assignments");
      await d.save();
    }
  }
}

async function stripAmbulanceReferencesForCompany(companyId: string): Promise<void> {
  await clearTeamAmbulancesForCompany(companyId);
  await clearDienstAssignmentAmbulancesForCompany(companyId);
}

export async function createCompany(
  data: CreateCompanyInput,
  createdBy?: string,
) {
  const doc: Record<string, unknown> = {
    name: data.name,
    isActive: data.isActive ?? true,
    emailDomain: data.emailDomain,
  };
  const resolvedPraemienMode: "automatic" | "manual" =
    data.praemienMode === "manual" ? "manual" : "automatic";
  if (Array.isArray(data.enabledModules)) {
    assertAutomaticPraemienRequiresWorkday(
      data.enabledModules,
      resolvedPraemienMode,
    );
    doc.enabledModules = data.enabledModules;
  }
  doc.praemienMode = resolvedPraemienMode;
  if (data.praemienModeEffectiveFrom !== undefined) {
    doc.praemienModeEffectiveFrom = data.praemienModeEffectiveFrom;
  } else {
    doc.praemienModeEffectiveFrom = null;
  }
  if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) {
    doc.createdBy = new mongoose.Types.ObjectId(createdBy);
  }
  const company = new Company(doc);
  return await company.save();
}

export async function getAllCompanies(options?: { includeDeleted?: boolean }) {
  const filter = options?.includeDeleted ? {} : { ...ACTIVE_COMPANY_FILTER };
  const companies = await Company.find(filter).sort({ createdAt: -1 }).lean();
  const companyIds = companies.map((c) => c._id as mongoose.Types.ObjectId);
  const roleMap = await aggregateUsersByRoleForCompanies(companyIds);

  return companies.map((company) => {
    const usersByRole = roleMap.get(company._id.toString()) ?? {
      admin: 0,
      worker: 0,
      mecanico: 0,
      jefe_mecanicos: 0,
      jefe_logistica: 0,
      total: 0,
    };
    return {
      ...company,
      adminCount: usersByRole.admin,
      workerCount: usersByRole.worker,
      userCount: usersByRole.total,
      usersByRole,
    };
  });
}

export async function getCompanyById(id: string) {
  const oid = parseCompanyOid(id);
  if (!oid) return null;
  return await Company.findOne({ _id: oid, ...ACTIVE_COMPANY_FILTER }).lean();
}

/** Soft-delete: marks deletedAt and deactivates; does not purge tenant data. */
export async function deleteCompany(id: string) {
  const oid = parseCompanyOid(id);
  if (!oid) return null;
  const now = new Date();
  return await Company.findOneAndUpdate(
    { _id: oid, ...ACTIVE_COMPANY_FILTER },
    { $set: { deletedAt: now, isActive: false } },
    { new: true },
  ).lean();
}

export async function getCompanyAdmins(companyId: string) {
  const oid = parseCompanyOid(companyId);
  if (!oid) return [];
  const company = await Company.findOne({ _id: oid, ...ACTIVE_COMPANY_FILTER })
    .select("_id")
    .lean();
  if (!company) return [];
  return await User.find(
    { companyId: oid, role: "admin" },
    { name: 1, lastName: 1, email: 1, _id: 1 },
  ).lean();
}

export async function getCompanySummary(id: string): Promise<CompanySummary | null> {
  const oid = parseCompanyOid(id);
  if (!oid) return null;
  const company = await Company.findOne({ _id: oid, ...ACTIVE_COMPANY_FILTER }).lean();
  if (!company) return null;

  const roleMap = await aggregateUsersByRoleForCompanies([oid]);
  const usersByRole = roleMap.get(oid.toString()) ?? {
    admin: 0,
    worker: 0,
    mecanico: 0,
    jefe_mecanicos: 0,
    jefe_logistica: 0,
    total: 0,
  };
  const enabledModules = Array.isArray(company.enabledModules)
    ? company.enabledModules
    : [];

  return {
    companyId: oid.toString(),
    name: company.name,
    isActive: company.isActive,
    deletedAt: company.deletedAt ?? null,
    emailDomain: company.emailDomain,
    enabledModules,
    enabledModulesCount: enabledModules.length,
    usersByRole,
    onboarding: buildOnboardingFlags(usersByRole, enabledModules),
  };
}

const COMPANY_USER_LIST_ROLES = [
  "admin",
  "worker",
  "mecanico",
  "jefe_mecanicos",
  "jefe_logistica",
] as const;

export async function getCompanyUsers(
  companyId: string,
  options?: {
    role?: string;
    isActive?: boolean;
    limit?: number;
    skip?: number;
  },
): Promise<{ users: CompanyUserListItem[]; total: number } | null> {
  const oid = parseCompanyOid(companyId);
  if (!oid) return null;
  const company = await Company.findOne({ _id: oid, ...ACTIVE_COMPANY_FILTER })
    .select("_id")
    .lean();
  if (!company) return null;

  const query: Record<string, unknown> = { companyId: oid };
  if (
    options?.role &&
    (COMPANY_USER_LIST_ROLES as readonly string[]).includes(options.role)
  ) {
    query.role = options.role;
  }
  if (options?.isActive === true || options?.isActive === false) {
    query.isActive = options.isActive;
  }

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const skip = Math.max(options?.skip ?? 0, 0);

  const [users, total] = await Promise.all([
    User.find(query, {
      name: 1,
      lastName: 1,
      email: 1,
      role: 1,
      isActive: 1,
    })
      .sort({ role: 1, lastName: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    users: users.map((u) => ({
      _id: String(u._id),
      name: u.name,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
    })),
    total,
  };
}

export async function updateCompany(id: string, data: UpdateCompanyInput) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const $set: Record<string, unknown> = {};
  if (data.name !== undefined) $set.name = data.name;
  if (data.isActive !== undefined) $set.isActive = data.isActive;
  let shouldStripAmbulanceModuleData = false;
  if (
    Array.isArray(data.enabledModules) ||
    data.praemienMode === "automatic"
  ) {
    const existingDoc = await Company.findById(id)
      .select("enabledModules praemienMode")
      .lean();
    if (!existingDoc) {
      return null;
    }
    const prev: string[] = Array.isArray(
      (existingDoc as { enabledModules?: string[] }).enabledModules,
    )
      ? ((existingDoc as { enabledModules: string[] }).enabledModules as string[])
      : [];
    const nextModules = Array.isArray(data.enabledModules)
      ? data.enabledModules
      : prev;
    const effectiveMode: "automatic" | "manual" =
      data.praemienMode !== undefined
        ? data.praemienMode === "manual"
          ? "manual"
          : "automatic"
        : (existingDoc as { praemienMode?: string }).praemienMode === "manual"
          ? "manual"
          : "automatic";
    assertAutomaticPraemienRequiresWorkday(nextModules, effectiveMode);
    if (Array.isArray(data.enabledModules)) {
      const next = data.enabledModules;
      shouldStripAmbulanceModuleData =
        prev.includes(MODULE_KEYS.AMBULANCES) && !next.includes(MODULE_KEYS.AMBULANCES);
      $set.enabledModules = data.enabledModules;
    }
  }
  if (data.praemienMode !== undefined) {
    $set.praemienMode = data.praemienMode;
  }
  if (data.praemienModeEffectiveFrom !== undefined) {
    $set.praemienModeEffectiveFrom = data.praemienModeEffectiveFrom;
  }
  if (data.emailDomain !== undefined) {
    $set.emailDomain = data.emailDomain;
  }
  const update: Record<string, unknown> = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys(update).length === 0) {
    return await Company.findById(id).lean();
  }
  const updated = await Company.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).lean();

  if (shouldStripAmbulanceModuleData && updated) {
    await stripAmbulanceReferencesForCompany(id);
  }

  return updated;
}
