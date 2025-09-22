// frontend/src/utils/url.ts
import api from '../api/axios';

// Obtiene el origen del backend a partir del baseURL de axios
// Ejemplo: http://localhost:5000/api -> http://localhost:5000
const getApiOrigin = () => {
  const base = api.defaults.baseURL || '';
  return base.replace(/\/api\/?$/, '');
};

/**
 * Convierte una ruta pública (por ej. "/uploads/archivo.pdf")
 * en una URL absoluta lista para <a href> o <img src>.
 */
export const getPublicUrl = (path: string) => `${getApiOrigin()}${path}`;

