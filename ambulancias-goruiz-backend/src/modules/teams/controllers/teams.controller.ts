import { Request, Response } from "express";
import * as teamsService from "../services/teams.service";
import { TeamError } from "../services/teams.service";

export const listTeams = async (_req: Request, res: Response): Promise<void> => {
  try {
    const teams = await teamsService.listTeams();
    res.status(200).json(teams);
  } catch (err: unknown) {
    if (err instanceof TeamError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("❌ Error listTeams:", err);
    res.status(500).json({ message: "Error al listar teams" });
  }
};

export const createTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const team = await teamsService.createTeam(req.body);
    res.status(201).json(team);
  } catch (err: unknown) {
    if (err instanceof TeamError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    if ((err as any)?.code === 11000) {
      res.status(409).json({ message: "Team duplicado (driver+medic ya existe)" });
      return;
    }
    console.error("❌ Error createTeam:", err);
    res.status(500).json({ message: "Error al crear team" });
  }
};

export const previewTeamRotationForWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { weekStartDate } = req.query as { weekStartDate?: string };
    const result = await teamsService.previewTeamRotationForWeek(weekStartDate);
    res.status(200).json(result);
  } catch (err: unknown) {
    if (err instanceof TeamError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("❌ Error en previewTeamRotationForWeek:", err);
    res.status(500).json({ message: "Error al calcular la rotación de equipos" });
  }
};

export const getUsedTeamsForWeek = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { weekStartDate } = req.query as { weekStartDate?: string };
    const result = await teamsService.getUsedTeamsForWeek(weekStartDate);
    res.status(200).json(result);
  } catch (err: unknown) {
    if (err instanceof TeamError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("❌ Error en getUsedTeamsForWeek:", err);
    res.status(500).json({ message: "Error al obtener equipos usados en la semana" });
  }
};

export const updateTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await teamsService.updateTeam(id, req.body);
    res.status(200).json(updated);
  } catch (err: unknown) {
    if (err instanceof TeamError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("❌ Error updateTeam:", err);
    res.status(500).json({ message: "Error al actualizar team" });
  }
};

export const deleteTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await teamsService.deleteTeam(id);
    res.status(200).json(result);
  } catch (err: unknown) {
    if (err instanceof TeamError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error("❌ Error deleteTeam:", err);
    res.status(500).json({ message: "Error al eliminar team" });
  }
};
