import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "http://localhost:5000/api", // <-- Aquí asegúrate de que sea la URL correcta de tu backend
  withCredentials: true,
});

export default axiosInstance;
