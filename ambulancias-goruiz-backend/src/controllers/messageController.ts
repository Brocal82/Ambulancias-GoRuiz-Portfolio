// backend/src/controllers/messageController.ts
import { Request, Response } from 'express';
import Message from '../models/Message';
import User from '../models/User';
import mongoose from 'mongoose';
import { Notification } from '../models/Notifications';

// 📨 Crear un nuevo mensaje (soporta 1 adjunto opcional en campo "attachment")
// + Crea notificaciones para cada destinatario (worker)
export const createMessage = async (req: Request, res: Response): Promise<void> => {
  const { subject, body } = req.body;
  const senderId = (req as any).userId;

  // 🔹 Normalizar toAllWorkers: puede venir como boolean (JSON) o string (multipart)
  const rawToAll = (req.body as any).toAllWorkers;
  const toAllWorkers =
    rawToAll === true ||
    rawToAll === 'true' ||
    rawToAll === 1 ||
    rawToAll === '1';

  // recipients puede venir como array (JSON) o como string (multipart/form-data)
  const rawRecipients = (req.body as any).recipients;

  // Parser robusto de recipients: acepta array nativo, JSON string o CSV simple
  let recipients: string[] | undefined;
  if (Array.isArray(rawRecipients)) {
    recipients = rawRecipients;
  } else if (typeof rawRecipients === 'string') {
    try {
      // Intento 1: JSON válido (e.g. '["id1","id2"]')
      const parsed = JSON.parse(rawRecipients);
      recipients = Array.isArray(parsed) ? parsed : undefined;
    } catch {
      // Intento 2: CSV simple (e.g. 'id1,id2')
      recipients = rawRecipients
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }
  }

  try {
    // Si se marca toAllWorkers, expandir destinatarios a TODOS los workers
    let finalRecipients: string[] = recipients ?? [];
    if (toAllWorkers) {
      const workers = await User.find({ role: 'worker' }).select('_id').lean();
      const allWorkerIds = workers.map(w => w._id.toString());
      // Unir sin duplicados
      const set = new Set<string>([...finalRecipients, ...allWorkerIds]);
      finalRecipients = Array.from(set);
    }

    if (!subject || !body || !Array.isArray(finalRecipients) || finalRecipients.length === 0) {
      res.status(400).json({ message: 'Faltan datos obligatorios o receptores inválidos' });
      return;
    }

        // Adjuntos: soportar uno o varios archivos
    const files = (req as any).files as Express.Multer.File[] | undefined;
    const singleFile = (req as any).file as Express.Multer.File | undefined;

    let attachments: {
      originalName: string;
      filename: string;
      mimetype: string;
      size: number;
      url: string;
    }[] = [];

    if (Array.isArray(files) && files.length > 0) {
      attachments = files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: `/uploads/${file.filename}`,
      }));
    } else if (singleFile) {
      attachments = [
        {
          originalName: singleFile.originalname,
          filename: singleFile.filename,
          mimetype: singleFile.mimetype,
          size: singleFile.size,
          url: `/uploads/${singleFile.filename}`,
        },
      ];
    }


    // 1) Crear el mensaje
    const newMessage = await Message.create({
      subject,
      body,
      sender: senderId,
      recipients: finalRecipients,
      toAllWorkers, // 👈 ahora es un boolean real ya normalizado
      attachments,
    });

    // 2) Crear notificaciones para cada destinatario (worker)
    try {
      const docs = finalRecipients.map((uid: string) => ({
        title: subject || 'Nuevo mensaje',
        message: body?.slice(0, 200) || 'Tienes un nuevo mensaje.',
        recipientId: new mongoose.Types.ObjectId(uid),
        role: 'worker' as const,
        type: 'message' as const,
      }));
      if (docs.length > 0) {
        await Notification.insertMany(docs);
      }
    } catch (nerr) {
      // No romper el envío del mensaje si fallan las notificaciones
      console.error('⚠️ No se pudieron crear notificaciones para el mensaje:', nerr);
    }

    res.status(201).json(newMessage);
    return;
  } catch (error) {
    console.error('❌ Error al crear mensaje:', error);
    res.status(500).json({ message: 'Error al enviar el mensaje' });
    return;
  }
};





// 📬 Obtener mensajes del usuario autenticado
// Soporta query ?unreadOnly=false para incluir leídos
export const getMyMessages = async (req: Request, res: Response): Promise<void> => {
  const userId = new mongoose.Types.ObjectId((req as any).userId as string);
  // default: true → solo no leídos (comportamiento previo)
  const unreadOnly =
    (req.query.unreadOnly as string | undefined)?.toLowerCase() === 'false' ? false : true;

  try {
    const filter: any = {
      recipients: userId,
      // ⬇️ siempre excluimos los mensajes “borrados” por este usuario
      removedBy: { $ne: userId },
    };

    if (unreadOnly) {
      filter.readBy = { $ne: userId };
    }

    const messages = await Message.find(filter)
      .sort({ sentAt: -1 })
      .populate('sender', 'name lastName');

    res.status(200).json(messages);
    return;
  } catch (error) {
    console.error('❌ Error al obtener mensajes:', error);
    res.status(500).json({ message: 'Error al obtener mensajes' });
    return;
  }
};




// 📤 Obtener mensajes enviados por el admin a todos los trabajadores
export const getSentMessages = async (req: Request, res: Response): Promise<void> => {
  const adminId = (req as any).userId;

  try {
    const messages = await Message.find({
      sender: adminId,
      toAllWorkers: true,
    })
      .sort({ sentAt: -1 })
      .select('subject body sentAt attachments'); // 👈 incluye adjuntos

    res.status(200).json(messages);
  } catch (error) {
    console.error('❌ Error al obtener mensajes enviados:', error);
    res.status(500).json({ message: 'Error al obtener mensajes enviados' });
  }
};

// 📚 Obtener mensajes enviados por el admin a un worker concreto
export const getMessagesForUserAsAdmin = async (req: Request, res: Response): Promise<void> => {
  const adminId = (req as any).userId as string;
  const { id } = req.params; // 👈 usamos "id" porque la ruta es /user/:id

  try {
    const messages = await Message.find({
      sender: adminId,
      recipients: new mongoose.Types.ObjectId(id),
    })
      .sort({ sentAt: -1 })
      .populate('sender', 'name lastName');

    res.status(200).json(messages);
  } catch (error) {
    console.error('❌ Error al obtener mensajes para usuario:', error);
    res.status(500).json({ message: 'Error al obtener mensajes para este usuario' });
  }
};




// 🗑️ Ocultar/marcar como leído para el usuario (no borra globalmente)
export const deleteMessageForUser = async (req: Request, res: Response): Promise<void> => {
  const userId = new mongoose.Types.ObjectId((req as any).userId as string);
  const messageId = req.params.id;

  try {
    const message = await Message.findById(messageId);

    if (!message) {
      res.status(404).json({ message: 'Mensaje no encontrado' });
      return;
    }

    // marcar como leído si no estaba
    if (!message.readBy.some(u => u.toString() === userId.toString())) {
      message.readBy.push(userId);
    }
    // ocultar para este usuario si no estaba
    if (!message.removedBy?.some(u => u.toString() === userId.toString())) {
      (message.removedBy as mongoose.Types.ObjectId[] | undefined)?.push(userId);
    }

    await message.save();
    res.status(200).json({ message: 'Mensaje marcado como leído/borrado' });
    return;
  } catch (error) {
    console.error('❌ Error al borrar mensaje:', error);
    res.status(500).json({ message: 'Error al borrar el mensaje' });
    return;
  }
};


// 🗑️ Borrar un mensaje (solo admin y solo si es el remitente)
export const deleteMessageByAdmin = async (req: Request, res: Response): Promise<void> => {
  const adminId = (req as any).userId as string;
  const { id } = req.params;

  try {
    const message = await Message.findById(id);

    if (!message) {
      res.status(404).json({ message: 'Mensaje no encontrado' });
      return;
    }

    // Solo puede borrar mensajes que él mismo envió
    if (message.sender.toString() !== adminId.toString()) {
      res.status(403).json({ message: 'No tienes permiso para borrar este mensaje' });
      return;
    }

    await Message.deleteOne({ _id: id });
    res.status(200).json({ message: 'Mensaje eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al borrar mensaje:', error);
    res.status(500).json({ message: 'Error al borrar el mensaje' });
  }
};

// ✅ Marcar un mensaje como leído (NO lo oculta)
export const markMessageAsRead = async (req: Request, res: Response): Promise<void> => {
  const userId = new mongoose.Types.ObjectId((req as any).userId as string);
  const { id } = req.params;

  try {
    const message = await Message.findById(id);
    if (!message) {
      res.status(404).json({ message: 'Mensaje no encontrado' });
      return;
    }

    // Añadir a readBy si no estaba
    if (!message.readBy.some(u => u.toString() === userId.toString())) {
      message.readBy.push(userId);
      await message.save();
    }

    res.status(200).json({ ok: true });
    return;
  } catch (error) {
    console.error('❌ Error al marcar como leído:', error);
    res.status(500).json({ message: 'Error al marcar como leído' });
    return;
  }
};




