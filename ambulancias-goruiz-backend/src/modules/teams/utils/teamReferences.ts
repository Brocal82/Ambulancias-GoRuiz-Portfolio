import mongoose from "mongoose";
import { Dienst } from "../../diensts";

export type TeamReferenceSource = "dienst-week-team";

export type TeamReferenceCheck = {
  inUse: boolean;
  sources: TeamReferenceSource[];
};

export async function findTeamReferences(
  teamId: string,
  companyId: string,
): Promise<TeamReferenceCheck> {
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const teamOid = new mongoose.Types.ObjectId(teamId);
  const sources: TeamReferenceSource[] = [];

  const dienstRef = await Dienst.exists({
    companyId: companyOid,
    weekTeamId: teamOid,
  }).lean();
  if (dienstRef) {
    sources.push("dienst-week-team");
  }

  return {
    inUse: sources.length > 0,
    sources,
  };
}

export class TeamInUseError extends Error {
  statusCode = 409;

  constructor(public sources: TeamReferenceSource[]) {
    super(
      "No se puede eliminar el equipo porque está referenciado en turnos de la semana",
    );
    this.name = "TeamInUseError";
  }
}
