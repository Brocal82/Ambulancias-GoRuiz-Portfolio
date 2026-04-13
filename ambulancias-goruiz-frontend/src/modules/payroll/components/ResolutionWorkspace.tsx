import type { User } from "../../users";
import type { PayrollDocument } from "../domain/types";
import WorkersMissingPayroll from "./WorkersMissingPayroll";
import UnassignedPayrolls from "./UnassignedPayrolls";

interface ResolutionWorkspaceProps {
  missingWorkers: User[];
  unassignedPayrolls: PayrollDocument[];
}

export default function ResolutionWorkspace({
  missingWorkers,
  unassignedPayrolls,
}: ResolutionWorkspaceProps) {
  return (
    <div className="space-y-4">
      <WorkersMissingPayroll missingWorkers={missingWorkers} />
      <UnassignedPayrolls unassignedPayrolls={unassignedPayrolls} />
    </div>
  );
}
