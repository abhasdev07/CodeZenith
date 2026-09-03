import axios from "axios";
import { API_BASE_URL } from "./apiBase";

let authTokenGetter = null;

export function setAuthTokenGetter(getter) {
  authTokenGetter = getter;
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // by adding this field browser will send the cookies to server automatically, on every single req
});

axiosInstance.interceptors.request.use(async (config) => {
  if (!authTokenGetter) return config;

  const token = await authTokenGetter();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default axiosInstance;
