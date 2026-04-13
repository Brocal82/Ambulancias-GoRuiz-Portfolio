import type { RefObject } from "react";
import type { User } from "../../users";
import type { PayrollDocument } from "../domain/types";
import WorkersMissingPayroll from "./WorkersMissingPayroll";
import UnassignedPayrolls from "./UnassignedPayrolls";

interface ResolutionWorkspaceProps {
  missingWorkers: User[];
  unassignedPayrolls: PayrollDocument[];
  workersMissingSectionRef?: RefObject<HTMLDivElement | null>;
  unassignedPayrollsSectionRef?: RefObject<HTMLDivElement | null>;
  highlightWorkersMissing?: boolean;
  highlightUnassignedPayrolls?: boolean;
}

export default function ResolutionWorkspace({
  missingWorkers,
  unassignedPayrolls,
  workersMissingSectionRef,
  unassignedPayrollsSectionRef,
  highlightWorkersMissing,
  highlightUnassignedPayrolls,
}: ResolutionWorkspaceProps) {
  return (
    <div className="space-y-4">
      <WorkersMissingPayroll
        missingWorkers={missingWorkers}
        sectionRef={workersMissingSectionRef}
        highlight={highlightWorkersMissing}
      />
      <UnassignedPayrolls
        unassignedPayrolls={unassignedPayrolls}
        sectionRef={unassignedPayrollsSectionRef}
        highlight={highlightUnassignedPayrolls}
      />
    </div>
  );
}
