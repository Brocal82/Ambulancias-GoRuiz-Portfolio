import { Request, Response } from "express";
import mongoose from "mongoose";
import Company from "../../companies/models/company.model";
import { voidEmitPraemienRulesChanged } from "../../notifications/utils/ws-notify";
import { normalizePraemienRuleConfig } from "../types/praemien-rule-config";
import { praemienRuleConfigSchema } from "../schemas/praemien-rules.schema";

function requireSessionCompany(req: Request): mongoose.Types.ObjectId | null {
  const companyId = typeof req.companyId === "string" ? req.companyId.trim() : "";
  if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) return null;
  return new mongoose.Types.ObjectId(companyId);
}

export async function getMyCompanyPraemienRules(
  req: Request,
  res: Response,
): Promise<void> {
  const companyOid = requireSessionCompany(req);
  if (!companyOid) {
    res.status(403).json({ message: "No perteneces a una empresa." });
    return;
  }

  try {
    const company = await Company.findById(companyOid).select("praemienRules").lean();
    if (!company) {
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    res.status(200).json(normalizePraemienRuleConfig(company.praemienRules));
  } catch {
    res.status(500).json({ message: "Error al obtener reglas de Prämien" });
  }
}

export async function updateMyCompanyPraemienRules(
  req: Request,
  res: Response,
): Promise<void> {
  const companyOid = requireSessionCompany(req);
  if (!companyOid) {
    res.status(403).json({ message: "No perteneces a una empresa." });
    return;
  }

  try {
    const parsed = praemienRuleConfigSchema.parse(req.body);
    const rules = normalizePraemienRuleConfig(parsed);
    const updated = await Company.findByIdAndUpdate(
      companyOid,
      { $set: { praemienRules: rules } },
      { new: true, runValidators: true },
    )
      .select("praemienRules")
      .lean();
    if (!updated) {
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    voidEmitPraemienRulesChanged(companyOid.toString());
    res.status(200).json(normalizePraemienRuleConfig(updated.praemienRules));
  } catch (error) {
    const err = error as { errors?: unknown[]; message?: string };
    if (err.errors) {
      res.status(400).json({ message: "Datos inválidos", errors: err.errors });
      return;
    }
    res.status(500).json({ message: "Error al guardar reglas de Prämien" });
  }
}
