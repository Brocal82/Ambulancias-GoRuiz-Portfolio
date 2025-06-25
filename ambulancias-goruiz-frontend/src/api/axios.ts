import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "http://localhost:5000/api",
});

// ✅ Interceptor de peticiones: añade token si existe
axiosInstance.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Interceptor de respuestas: redirige si el token ha expirado o no autorizado
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn("Token expirado o acceso prohibido. Cerrando sesión...");
      localStorage.clear();
      window.location.href = "/login"; // 🔁 Redirección inmediata al login
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
