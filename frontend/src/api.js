import axios from "axios";
import { getItem, removeItem } from "./utils/storage";

// The Vercel deployment has no /api proxy, so a production build without VITE_API_URL
// would send every request to the static host and fail confusingly. Fail loudly instead.
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  throw new Error("VITE_API_URL is not set. Configure it to the backend URL (e.g. https://<backend>/api).");
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = getItem("sinew_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 on a normal request means the session is gone (expired token, deleted account).
// Login/signup 401s just mean bad credentials and are left for the form to display.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isCredentialCheck = url.startsWith("/auth/login") || url.startsWith("/auth/signup");
    if (error.response?.status === 401 && !isCredentialCheck) {
      removeItem("sinew_token");
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

export default api;
