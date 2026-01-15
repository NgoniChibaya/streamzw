import axios from "axios";
import { baseUrl } from "./Constants/Constance";

const instance = axios.create({
  baseURL: baseUrl,
});

// Add request interceptor to include Django token in all requests
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('django_token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default instance;
