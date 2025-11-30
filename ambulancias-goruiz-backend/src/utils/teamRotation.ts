// backend/src/utils/teamRotation.ts
import { Types } from 'mongoose';

/**
 * Modo de rotación de un equipo.
 *  - 'fixed'    → el equipo va siempre al mismo número de Dienst (fixedDienstNumber)
 *  - 'rotating' → lógica de rotación (la implementaremos después)
 *  - 'none'     → sin comportamiento automático (asignación manual)
 */
export type RotationMode = 'rotating' | 'fixed' | 'none';

export interface TeamRotationInfo {
  teamId: Types.ObjectId | string;
  rotationMode: RotationMode;
  fixedDienstNumber?: number | null;
}

/**
 * Datos de entrada para calcular asignaciones automáticas de equipos en una semana.
 */
export interface WeekRotationInput {
  /**
   * Lista de números de Dienst que existen en la semana.
   * Por ejemplo: [1, 2, 3, 4, 5]
   */
  dienstNumbers: number[];

  /**
   * Equipos con su modo de rotación.
   */
  teams: TeamRotationInfo[];

  /**
   * (Opcional) Asignaciones de la semana anterior.
   * Lo usaremos más adelante para el modo 'rotating'.
   */
  previousWeekAssignments?: Array<{
    teamId: string;
    dienstNumber: number;
  }>;
}

/**
 * Resultado de las asignaciones de equipos para una semana.
 */
export interface WeekRotationResult {
  /**
   * Asignaciones calculadas: qué team va a qué número de Dienst.
   */
  assignments: Array<{
    dienstNumber: number;
    teamId: string;
  }>;
}

/**
 * Motor de rotación (versión 1):
 *  - Ahora mismo SOLO aplica equipos con rotationMode === 'fixed'.
 *  - Si hay varios equipos con el mismo fixedDienstNumber, se queda con el primero.
 *  - No toca los equipos 'rotating' ni 'none' (los trataremos en pasos posteriores).
 */
export function computeTeamAssignmentsForWeek(input: WeekRotationInput): WeekRotationResult {
  const { dienstNumbers, teams } = input;

  const assignments: Array<{ dienstNumber: number; teamId: string }> = [];
  const usedDiensts = new Set<number>();
  const assignedTeams = new Set<string>();

  // 1) Equipos de Dienst fijo
  const fixedTeams = teams.filter(
    (t) => t.rotationMode === 'fixed' && t.fixedDienstNumber != null
  );

  for (const team of fixedTeams) {
    const dn = team.fixedDienstNumber as number;
    const teamIdStr = team.teamId.toString();

    // Solo asignamos si:
    //  - el número de Dienst existe en esta semana
    //  - ese número aún no está ocupado por otro equipo
    if (dienstNumbers.includes(dn) && !usedDiensts.has(dn)) {
      assignments.push({
        dienstNumber: dn,
        teamId: teamIdStr,
      });
      usedDiensts.add(dn);
      assignedTeams.add(teamIdStr);
    }
  }

  // 2) En esta versión NO hacemos nada aún con:
  //    - equipos 'rotating'
  //    - equipos 'none'
  //    Los manejaremos en pasos posteriores.

  return { assignments };
}
