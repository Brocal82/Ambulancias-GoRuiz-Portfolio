import axios, { AxiosHeaders } from "axios";


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

// ✅ Interceptor de peticiones: añade token y Accept-Language usando AxiosHeaders (tipado correcto)
axiosInstance.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token");
    const lang = (localStorage.getItem("lang") as string) || "es";

    // Normaliza headers a instancia de AxiosHeaders
    config.headers = AxiosHeaders.from(config.headers);

    const headers = config.headers as AxiosHeaders;

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    headers.set("Accept-Language", lang);

    return config;
  },
  (error) => Promise.reject(error)
);



export default axiosInstance;
