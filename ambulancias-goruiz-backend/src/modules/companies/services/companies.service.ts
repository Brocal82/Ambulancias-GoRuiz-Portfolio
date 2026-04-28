import mongoose from "mongoose";
import Company from "../models/company.model";
import User from "../../users/models/user.model";
import { Team } from "../../teams/models/team.model";
import Dienst from "../../diensts/models/dienst.model";
import { MODULE_KEYS } from "../constants/modules.constants";
import type { CreateCompanyInput, UpdateCompanyInput } from "../schemas/company.schema";

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

export async function getAllCompanies() {
  const companies = await Company.find().sort({ createdAt: -1 }).lean();

  const [workerCounts, adminCounts] = await Promise.all([
    User.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { companyId: { $exists: true } } },
      { $group: { _id: "$companyId", count: { $sum: 1 } } },
    ]),
    User.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { companyId: { $exists: true }, role: "admin" } },
      { $group: { _id: "$companyId", count: { $sum: 1 } } },
    ]),
  ]);

  const workerMap = new Map(workerCounts.map((c) => [c._id.toString(), c.count]));
  const adminMap = new Map(adminCounts.map((c) => [c._id.toString(), c.count]));

  return companies.map((company) => ({
    ...company,
    workerCount: workerMap.get(company._id.toString()) ?? 0,
    adminCount: adminMap.get(company._id.toString()) ?? 0,
  }));
}

export async function getCompanyById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Company.findById(id).lean();
}

export async function deleteCompany(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Company.findByIdAndDelete(id).lean();
}

export async function getCompanyAdmins(companyId: string) {
  if (!mongoose.Types.ObjectId.isValid(companyId)) return [];
  return await User.find(
    { companyId: new mongoose.Types.ObjectId(companyId), role: "admin" },
    { name: 1, lastName: 1, email: 1, _id: 1 },
  ).lean();
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
