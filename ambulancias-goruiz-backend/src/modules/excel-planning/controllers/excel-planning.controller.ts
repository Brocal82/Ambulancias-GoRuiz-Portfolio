import type { Request, Response } from "express";
import {
  getTemplateForAdmin,
  upsertTemplateForAdmin,
  createImportFromUpload,
  getImportForAdmin,
  publishImportForAdmin,
  listWeeksForAdmin,
  getWeekForAdmin,
  getMyPublishedWeek,
  discardImportForAdmin,
  exportExcelBufferForAdmin,
} from "../services/excel-planning.service";
import type { PutExcelPlanningTemplateBody } from "../schemas/excel-planning.schemas";
import type { PublishExcelImportBody } from "../schemas/excel-planning.schemas";
import type { PostExcelExportBody } from "../schemas/excel-planning.schemas";

function sendErr(res: Response, status: number, message: string) {
  res.status(status).json({ message });
}

export async function getTemplate(req: Request, res: Response) {
  const out = await getTemplateForAdmin(req);
  if (!out.ok) {
    sendErr(res, out.statusCode, out.message);
    return;
  }
  res.json(out.data);
}

export async function putTemplate(req: Request, res: Response) {
  const body = req.body as PutExcelPlanningTemplateBody;
  const out = await upsertTemplateForAdmin(req, body);
  if (!out.ok) {
    sendErr(res, out.statusCode, out.message);
    return;
  }
  res.json(out.data);
}

export async function postImport(req: Request, res: Response) {
  const out = await createImportFromUpload(req, req.file);
  if (!out.ok) {
    sendErr(res, out.statusCode, out.message);
    return;
  }
  res.status(201).json(out.data);
}

export async function postExport(req: Request, res: Response) {
  const body = req.body as PostExcelExportBody;
  const out = await exportExcelBufferForAdmin(req, body);
  if (!out.ok) {
    sendErr(res, out.statusCode, out.message);
    return;
  }
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${out.filename}"`,
  );
  res.send(out.buffer);
}

export async function getImport(req: Request, res: Response) {
  const { id } = req.params;
  const out = await getImportForAdmin(req, id);
  if (!out.ok) {
    sendErr(res, out.statusCode, out.message);
    return;
  }
  res.json(out.data);
}

export async function postPublishImport(req: Request, res: Response) {
  const { id } = req.params;
  const body = req.body as PublishExcelImportBody;
  const out = await publishImportForAdmin(req, id, body);
  if (!out.ok) {
    sendErr(res, out.statusCode, out.message);
    return;
  }
  res.json(out.data);
}

export async function deleteImportDraft(req: Request, res: Response) {
  const { id } = req.params;
  const out = await discardImportForAdmin(req, id);
  if (!out.ok) {
    sendErr(res, out.statusCode, out.message);
    return;
  }
  res.json(out.data);
}

export async function listWeeks(req: Request, res: Response) {
  const out = await listWeeksForAdmin(req);
  if (!out.ok) {
    sendErr(res, out.statusCode, out.message);
    return;
  }
  res.json(out.data);
}

export async function getWeek(req: Request, res: Response) {
  const { weekStart } = req.params;
  const out = await getWeekForAdmin(req, weekStart);
  if (!out.ok) {
    sendErr(res, out.statusCode, out.message);
    return;
  }
  res.json(out.data);
}

export async function getMyWeek(req: Request, res: Response) {
  const weekStart =
    typeof req.query.weekStart === "string" ? req.query.weekStart : undefined;
  const out = await getMyPublishedWeek(req, weekStart);
  if (!out.ok) {
    sendErr(res, out.statusCode, out.message);
    return;
  }
  res.json(out.data);
}
