import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "http://localhost:5000/api",
  // ❌ Solo deja withCredentials si usas cookies; si no, mejor quitarlo
});

// ✅ Interceptor: solo añade token si existe
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default axiosInstance;
