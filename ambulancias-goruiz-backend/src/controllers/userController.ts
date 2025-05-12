import { Request, Response } from 'express';
import { User } from '../models/User';
import { IUser } from '../types/User';
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken';

// Función para validar el formato del email
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ✅ createUser como función async que devuelve void
export const createUser = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body as IUser;

  if (!password || password.length < 6) {
    res.status(400).json({ message: 'La contraseña es obligatoria y debe tener al menos 6 caracteres' });
    return;
  }
  

  if (!name || !email) {
    res.status(400).json({ message: 'El nombre y el email son obligatorios' });
    return;
  }

  if (!validateEmail(email)) {
    res.status(400).json({ message: 'El formato del email no es válido' });
    return;
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'Ya existe un usuario con ese email' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    console.log('✅ Usuario guardado:', newUser);
    res.status(201).json(newUser);
  } catch (error) {
    console.error('❌ Error al crear usuario:', error);
    res.status(500).json({ message: 'Error al crear el usuario' });
  }
};

// ✅ getUsers como función async que devuelve void
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    console.error('❌ Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
};

// ✅ updateUser como función async que devuelve void
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, email } = req.body;

  if (!name || !email) {
    res.status(400).json({ message: 'El nombre y el email son obligatorios' });
    return;
  }

  if (!validateEmail(email)) {
    res.status(400).json({ message: 'El formato del email no es válido' });
    return;
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(id, { name, email }, { new: true });

    if (!updatedUser) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    console.log('✅ Usuario actualizado:', updatedUser);
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('❌ Error al actualizar usuario:', error);
    res.status(500).json({ message: 'Error al actualizar el usuario' });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('❌ Error al obtener usuario:', error);
    res.status(500).json({ message: 'Error al obtener el usuario' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.status(200).json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error al eliminar el usuario' });
  }
};


export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email y contraseña son obligatorios' });
    return;
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Contraseña incorrecta' });
      return;
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    res.status(200).json({ message: 'Login exitoso', token });
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
};

