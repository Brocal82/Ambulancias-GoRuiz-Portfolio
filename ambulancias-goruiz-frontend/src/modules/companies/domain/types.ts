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
  userCount?: number;
  usersByRole?: CompanyUsersByRole;
  /** true si falta admin, worker o módulos configurados */
  needsOnboarding?: boolean;
}

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
  deletedAt: string | null;
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

export type CompanyUsersResponse = {
  users: CompanyUserListItem[];
  total: number;
};

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

export type CreateCompanyAdminInvitationResponse = {
  invitationId: string;
  token: string;
  expiresAt: string;
  email: string;
  role: "admin";
};

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
