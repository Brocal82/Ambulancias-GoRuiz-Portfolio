// src/utils/jwtUtils.ts
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  exp?: number;
}

export function getTokenExpiration(token: string): number | null {
  try {
    const decoded = jwtDecode<DecodedToken>(token);
    if (decoded.exp) {
      return decoded.exp * 1000; // convertir a milisegundos
    }
    return null;
  } catch (error) {
    console.error('Error al decodificar el token:', error);
    return null;
  }
}
