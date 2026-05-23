import { Request, Response } from "express";
import * as messagesService from "../services/messages.service";
import { Message } from "../models/message.model";
import User from "../../users/models/user.model";
import {
  requireCompanyForAdmin,
  isSameCompany,
} from "../../../utils/requireCompany";
import { unlinkMulterFiles } from "../../../utils/unlinkUploadedFiles";
import {
  MESSAGE_NO_VALID_RECIPIENTS_ERROR,
  MESSAGE_VALIDATION_ERROR,
} from "../services/messages.service";
import { MESSAGE_MAX_ATTACHMENTS } from "../schemas/message.schema";

function assertUserCanAccessMessage(
  message: { recipients: unknown[] },
  userId: string,
  userRole: string,
): boolean {
  const isAdmin = userRole === "admin";
  const isRecipient = message.recipients.some(
    (r) => String(r) === userId,
  );
  return isAdmin || isRecipient;
}

function getUploadedFiles(req: Request): Express.Multer.File[] | undefined {
  const files = (req as Request & { files?: Express.Multer.File[] }).files;
  return Array.isArray(files) ? files : undefined;
}

function buildAttachmentsFromReq(req: Request): {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
}[] {
  const files = (req as any).files as Express.Multer.File[] | undefined;
  const singleFile = (req as any).file as Express.Multer.File | undefined;

  if (Array.isArray(files) && files.length > 0) {
    return files.map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    }));
  }
  if (singleFile) {
    return [
      {
        originalName: singleFile.originalname,
        filename: singleFile.filename,
        mimetype: singleFile.mimetype,
        size: singleFile.size,
        url: `/uploads/${singleFile.filename}`,
      },
    ];
  }
  return [];
}

export const createMessage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const uploadedFiles = getUploadedFiles(req);

  try {
    const { subject, body, toAllWorkers, recipients } = req.body as {
      subject: string;
      body: string;
      toAllWorkers?: boolean;
      recipients?: string[];
    };
    const senderId = req.userId as string;

    if ((uploadedFiles?.length ?? 0) > MESSAGE_MAX_ATTACHMENTS) {
      await unlinkMulterFiles(uploadedFiles);
      res.status(400).json({
        message: `Máximo ${MESSAGE_MAX_ATTACHMENTS} adjuntos por mensaje`,
      });
      return;
    }

    const newMessage = await messagesService.createMessage({
      subject,
      body,
      senderId,
      senderCompanyId: companyResult.companyId,
      toAllWorkers: toAllWorkers ?? false,
      recipients: recipients ?? [],
      attachments: buildAttachmentsFromReq(req),
    });

    res.status(201).json(newMessage);
  } catch (error: unknown) {
    await unlinkMulterFiles(uploadedFiles);
    console.error("❌ Error al crear mensaje:", error);
    const msg = error instanceof Error ? error.message : "";
    const isClientError =
      msg === MESSAGE_VALIDATION_ERROR ||
      msg === MESSAGE_NO_VALID_RECIPIENTS_ERROR ||
      msg.includes("Faltan datos");
    const status = isClientError ? 400 : 500;
    res.status(status).json({
      message: status === 400 ? msg : "Error al enviar el mensaje",
    });
  }
};

export const getMyMessages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId as string;
    const unreadOnly =
      (req.query.unreadOnly as string | undefined)?.toLowerCase() === "false"
        ? false
        : true;

    const messages = await messagesService.getMyMessages(
      userId,
      unreadOnly,
      req.companyId,
    );
    res.status(200).json(messages);
  } catch (error) {
    console.error("❌ Error al obtener mensajes:", error);
    res.status(500).json({ message: "Error al obtener mensajes" });
  }
};

export const getSentMessages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  try {
    const adminId = req.userId as string;
    const messages = await messagesService.getSentMessages(adminId, companyResult.companyId);
    res.status(200).json(messages);
  } catch (error) {
    console.error("❌ Error al obtener mensajes enviados:", error);
    res
      .status(500)
      .json({ message: "Error al obtener mensajes enviados" });
  }
};

export const getMessagesForUserAsAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  try {
    const adminId = req.userId as string;
    const userId = req.params.id;
    const targetUser = await User.findById(userId).select("companyId").lean();
    if (
      !targetUser ||
      !isSameCompany(targetUser.companyId, companyResult.companyId)
    ) {
      res.status(403).json({ message: "No tienes permiso para ver mensajes de este usuario" });
      return;
    }
    const messages = await messagesService.getMessagesForUserAsAdmin(
      adminId,
      userId,
      companyResult.companyId,
    );
    res.status(200).json(messages);
  } catch (error) {
    console.error("❌ Error al obtener mensajes para usuario:", error);
    res
      .status(500)
      .json({ message: "Error al obtener mensajes para este usuario" });
  }
};

export const deleteMessageForUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId as string;
    const messageId = req.params.id;

    const message = await Message.findById(messageId).populate("sender", "companyId");
    if (!message) {
      res.status(404).json({ message: "Mensaje no encontrado" });
      return;
    }

    if (!assertUserCanAccessMessage(message, userId, req.userRole ?? "")) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }

    const sender = message.sender as any;
    const userCompanyId = req.companyId;
    if (userCompanyId) {
      if (!sender?.companyId || String(sender.companyId) !== String(userCompanyId)) {
        res.status(403).json({ message: "No autorizado" });
        return;
      }
    } else if (sender?.companyId) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }

    const result = await messagesService.deleteMessageForUser(
      userId,
      messageId,
    );

    if (!result) {
      res.status(404).json({ message: "Mensaje no encontrado" });
      return;
    }

    res.status(200).json({ message: "Mensaje marcado como leído/borrado" });
  } catch (error) {
    console.error("❌ Error al borrar mensaje:", error);
    res.status(500).json({ message: "Error al borrar el mensaje" });
  }
};

export const deleteMessageByAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  try {
    const adminId = req.userId as string;
    const messageId = req.params.id;
    const result = await messagesService.deleteMessageByAdmin(
      adminId,
      messageId,
      companyResult.companyId,
    );

    if (result.kind === "not_found") {
      res.status(404).json({ message: "Mensaje no encontrado" });
      return;
    }
    if (result.kind === "forbidden") {
      res
        .status(403)
        .json({ message: "No tienes permiso para borrar este mensaje" });
      return;
    }

    res.status(200).json({ message: "Mensaje eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error al borrar mensaje:", error);
    res.status(500).json({ message: "Error al borrar el mensaje" });
  }
};

export const markMessageAsRead = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId as string;
    const messageId = req.params.id;

    const message = await Message.findById(messageId).populate("sender", "companyId");
    if (!message) {
      res.status(404).json({ message: "Mensaje no encontrado" });
      return;
    }

    if (!assertUserCanAccessMessage(message, userId, req.userRole ?? "")) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }

    const sender = message.sender as any;
    const userCompanyId = req.companyId;
    if (userCompanyId) {
      if (!sender?.companyId || String(sender.companyId) !== String(userCompanyId)) {
        res.status(403).json({ message: "No autorizado" });
        return;
      }
    } else if (sender?.companyId) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }

    const result = await messagesService.markMessageAsRead(userId, messageId);

    if (!result) {
      res.status(404).json({ message: "Mensaje no encontrado" });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("❌ Error al marcar como leído:", error);
    res.status(500).json({ message: "Error al marcar como leído" });
  }
};
