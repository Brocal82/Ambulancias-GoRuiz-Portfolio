// backend/src/controllers/messageController.ts
import { Request, Response } from 'express';
import Message from '../models/Message';
import User from '../models/User';
import mongoose from 'mongoose';

// 📨 Crear un nuevo mensaje
export const createMessage = async (req: Request, res: Response): Promise<void> => {
  const { subject, body, recipients } = req.body;
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
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('❌ Error al crear mensaje:', error);
    res.status(500).json({ message: 'Error al enviar el mensaje' });
  }
};

// 📬 Obtener todos los mensajes recibidos por el usuario autenticado
export const getMyMessages = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).userId;


  try {
    const messages = await Message.find({ recipients: userId })
      .sort({ sentAt: -1 })
      .populate('sender', 'name lastName');

    res.status(200).json(messages);
  } catch (error) {
    console.error('❌ Error al obtener mensajes:', error);
    res.status(500).json({ message: 'Error al obtener mensajes' });
  }
};
