import { AdminManualPraemieQueuePanel } from "../components/AdminManualPraemieQueuePanel";
import { AdminPraemienRulesPanel } from "../components/AdminPraemienRulesPanel";

export default function AdminPraemienPage() {
  return (
    <div className="space-y-4">
      <AdminPraemienRulesPanel />
      <AdminManualPraemieQueuePanel />
    </div>
  );
}
