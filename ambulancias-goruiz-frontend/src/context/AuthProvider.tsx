// src/context/AuthProvider.tsx
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import type { User } from '../types/user';
import { getTokenExpiration } from '../utils/jwtUtils';
import { toast } from 'react-toastify';

interface Props {
  children: ReactNode;
}

export const AuthProvider = ({ children }: Props) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('token');
    const storedUserId = sessionStorage.getItem('userId');
    const storedRole = sessionStorage.getItem('role');
    const storedUser = sessionStorage.getItem('user');

    if (storedToken && storedUserId && storedRole) {
      setToken(storedToken);
      setUserId(storedUserId);
      setRole(storedRole);
      if (storedUser) setUser(JSON.parse(storedUser));
    }
  }, []);

  // 🔔 Advertencia antes de que expire el token
  useEffect(() => {
    if (!token) return;

    const expiration = getTokenExpiration(token);
    if (!expiration) return;

    const timeLeft = expiration - Date.now();
    const warningThreshold = 60 * 1000; // 1 minuto

    if (timeLeft > warningThreshold) {
      const timer = setTimeout(() => {
        toast.warn('⚠️ Tu sesión está a punto de expirar. Por favor, guarda tu trabajo.', {
          position: 'top-right',
          autoClose: 10000,
        });
      }, timeLeft - warningThreshold);

      return () => clearTimeout(timer);
    }
  }, [token]);

  const login = (newToken: string, newUserId: string, newRole: string, newUser: User) => {
    setToken(newToken);
    setUserId(newUserId);
    setRole(newRole);
    setUser(newUser);

    sessionStorage.setItem('token', newToken);
    sessionStorage.setItem('userId', newUserId);
    sessionStorage.setItem('role', newRole);
    sessionStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUserId(null);
    setRole(null);
    setUser(null);

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('user');

    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ token, userId, role, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
