// backend/src/controllers/messageController.ts
import { Request, Response } from 'express';
import Message from '../models/Message';
import User from '../models/User';
import mongoose from 'mongoose';

// 📨 Crear un nuevo mensaje
export const createMessage = async (req: Request, res: Response): Promise<void> => {
  const { subject, body, recipients, toAllWorkers } = req.body;
  const senderId = (req as any).userId;

  if (!subject || !body || !recipients || !Array.isArray(recipients)) {
    res.status(400).json({ message: 'Faltan datos obligatorios o receptores inválidos' });
    return;
  }

  try {
    const newMessage = await Message.create({
      subject,
      body,
      sender: senderId,
      recipients,
      toAllWorkers: Boolean(toAllWorkers), // ✅ Guardamos el flag si existe
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('❌ Error al crear mensaje:', error);
    res.status(500).json({ message: 'Error al enviar el mensaje' });
  }
};


// 📬 Obtener todos los mensajes recibidos por el usuario autenticado
export const getMyMessages = async (req: Request, res: Response): Promise<void> => {
  const userId = new mongoose.Types.ObjectId((req as any).userId as string);

  try {
    const messages = await Message.find({
      recipients: userId,
      readBy: { $ne: userId },
    })
      .sort({ sentAt: -1 })
      .populate('sender', 'name lastName');

    res.status(200).json(messages);
  } catch (error) {
    console.error('❌ Error al obtener mensajes:', error);
    res.status(500).json({ message: 'Error al obtener mensajes' });
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
      .select('subject body sentAt'); // devolvemos solo campos necesarios

    res.status(200).json(messages);
  } catch (error) {
    console.error('❌ Error al obtener mensajes enviados:', error);
    res.status(500).json({ message: 'Error al obtener mensajes enviados' });
  }
};

// 🗑️ Marcar mensaje como leído/borrado por el usuario
export const deleteMessageForUser = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId;
  const messageId = req.params.id;

  try {
    const message = await Message.findById(messageId);

    if (!message) {
      res.status(404).json({ message: 'Mensaje no encontrado' });
      return;
    }

    // Si ya fue marcado como leído/borrado, no hacer nada
    if (!message.readBy.includes(userId)) {
      message.readBy.push(userId);
      await message.save();
    }

    res.status(200).json({ message: 'Mensaje marcado como leído/borrado' });
  } catch (error) {
    console.error('❌ Error al marcar mensaje como leído:', error);
    res.status(500).json({ message: 'Error al borrar el mensaje' });
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



