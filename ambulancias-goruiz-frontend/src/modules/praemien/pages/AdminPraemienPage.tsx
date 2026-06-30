import { AdminManualPraemieQueuePanel } from "../components/AdminManualPraemieQueuePanel";
import { AdminPraemienRulesPanel } from "../components/AdminPraemienRulesPanel";
import { PraemienImpactResolutionPanel } from "../components/PraemienImpactResolutionPanel";

export default function AdminPraemienPage() {
  return (
    <div className="space-y-4">
      <div className="mx-auto min-w-0 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <AdminPraemienRulesPanel />
      </div>
      {/* Phase 3.4.3 — hidden when no pending closed-month resolutions exist */}
      <PraemienImpactResolutionPanel />
      <AdminManualPraemieQueuePanel />
    </div>
  );
}
