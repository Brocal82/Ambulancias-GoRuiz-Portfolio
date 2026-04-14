import type { RefObject } from "react";
import type { User } from "../../users";
import WorkersMissingPayroll from "./WorkersMissingPayroll";

interface ResolutionWorkspaceProps {
  missingWorkers: User[];
  workersMissingSectionRef?: RefObject<HTMLDivElement | null>;
  highlightWorkersMissing?: boolean;
}

export default function ResolutionWorkspace({
  missingWorkers,
  workersMissingSectionRef,
  highlightWorkersMissing,
}: ResolutionWorkspaceProps) {
  return (
    <div className="space-y-4">
      <WorkersMissingPayroll
        missingWorkers={missingWorkers}
        sectionRef={workersMissingSectionRef}
        highlight={highlightWorkersMissing}
      />
    </div>
  );
}
