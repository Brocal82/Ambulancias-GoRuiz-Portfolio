import axios, { AxiosHeaders } from "axios";

// Usa la variable de entorno VITE_API_URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const axiosInstance = axios.create({
  baseURL: API_URL,
});

// Interceptor: añade token si existe
axiosInstance.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token");
    if (token) {
      config.headers = AxiosHeaders.from(config.headers);
      const headers = config.headers as AxiosHeaders;
      headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: idioma
axiosInstance.interceptors.request.use(
  (config) => {
    const lang = (localStorage.getItem("lang") as string) || "es";
    config.headers = AxiosHeaders.from(config.headers);
    const headers = config.headers as AxiosHeaders;
    headers.set("Accept-Language", lang);
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosInstance;
