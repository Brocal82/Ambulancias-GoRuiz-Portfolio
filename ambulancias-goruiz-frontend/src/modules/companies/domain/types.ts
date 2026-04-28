/** First month when a scheduled praemien mode change takes effect (next-month rule). */
export type PraemienModeEffectiveFrom = { year: number; month: number };

export interface Company {
  _id: string;
  name: string;
  isActive: boolean;
  emailDomain: string;
  enabledModules: string[];
  /** When `praemien` is enabled; Phase 1 storage only for manual. */
  praemienMode?: "automatic" | "manual";
  praemienModeEffectiveFrom?: PraemienModeEffectiveFrom | null;
  workerCount?: number;
  adminCount?: number;
}

export interface CompanyAdmin {
  _id: string;
  name: string;
  lastName: string;
  email: string;
}

export interface CreateCompanyInput {
  name: string;
  emailDomain: string;
  enabledModules?: string[];
  praemienMode?: "automatic" | "manual";
  praemienModeEffectiveFrom?: PraemienModeEffectiveFrom | null;
}

export interface UpdateCompanyInput {
  name?: string;
  isActive?: boolean;
  emailDomain?: string;
  enabledModules?: string[];
  praemienMode?: "automatic" | "manual";
  praemienModeEffectiveFrom?: PraemienModeEffectiveFrom | null;
}

export interface CreateAdminInput {
  name: string;
  lastName: string;
  email: string;
  password: string;
}
