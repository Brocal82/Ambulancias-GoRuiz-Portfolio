// src/context/AuthProvider.tsx
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import type { User } from '../types/user';

interface Props {
  children: ReactNode;
}

export const AuthProvider = ({ children }: Props) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUserId = localStorage.getItem('userId');
    const storedRole = localStorage.getItem('role');

    if (storedToken && storedUserId && storedRole) {
      setToken(storedToken);
      setUserId(storedUserId);
      setRole(storedRole);
    }
  }, []);

  
const [user, setUser] = useState<User | null>(null);

const login = (newToken: string, newUserId: string, newRole: string, newUser: User) => {
  setToken(newToken);
  setUserId(newUserId);
  setRole(newRole);
  setUser(newUser); // ✅ aquí añadimos el usuario completo

  localStorage.setItem('token', newToken);
  localStorage.setItem('userId', newUserId);
  localStorage.setItem('role', newRole);
  localStorage.setItem('user', JSON.stringify(newUser)); // ✅ opcional: guardar también el user completo
};


  const logout = () => {
    setToken(null);
    setUserId(null);
    setRole(null);
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ token, userId, role, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
