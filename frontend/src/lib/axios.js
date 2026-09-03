import axios from "axios";
import { API_BASE_URL } from "./apiBase";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // by adding this field browser will send the cookies to server automatically, on every single req
});

export default axiosInstance;
