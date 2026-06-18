import mongoose from "mongoose";
import Company from "../../companies/models/company.model";
import {
  DEFAULT_PRAEMIEN_RULE_CONFIG,
  normalizePraemienRuleConfig,
  type PraemienRuleConfig,
} from "../types/praemien-rule-config";

export async function getPraemienRuleConfigForCompany(
  companyId: mongoose.Types.ObjectId,
): Promise<PraemienRuleConfig> {
  const company = await Company.findById(companyId).select("praemienRules").lean();
  return normalizePraemienRuleConfig(company?.praemienRules);
}

export function getDefaultPraemienRuleConfig(): PraemienRuleConfig {
  return normalizePraemienRuleConfig(DEFAULT_PRAEMIEN_RULE_CONFIG);
}
