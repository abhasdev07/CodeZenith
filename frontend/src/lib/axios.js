import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://codezenith-pip3.onrender.com/api";

console.log("API_URL =", API_URL);

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export default axiosInstance;