import axios from "axios";

const rawBackendUrl = process.env.REACT_APP_BACKEND_URL || "";
const backendUrl = rawBackendUrl.trim().replace(/\/+$/, "");

const api = axios.create({
  baseURL: backendUrl || undefined,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    if (typeof response.data === "string" && response.data.trim().toLowerCase().startsWith("<!doctype html")) {
      return Promise.reject(new Error("Received HTML response instead of JSON. Ensure REACT_APP_BACKEND_URL is set in Vercel Environment Variables."));
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export function formatApiError(error) {
  // If static hosting returned 405 (Method Not Allowed) when POSTing to the Vercel static URL
  if (error.response?.status === 405 || (!backendUrl && typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1")) {
    return "Backend URL not configured: Please add REACT_APP_BACKEND_URL (your Render backend URL) in Vercel Project Settings > Environment Variables, then Redeploy.";
  }

  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(" ");
  if (error.response?.status === 502 || error.response?.status === 503) {
    return "Backend service is currently starting up or unavailable. Please wait a moment and try again.";
  }
  if (error.message) {
    if (error.message.includes("Network Error")) {
      return "Unable to connect to the backend server. Please check your connection and ensure the backend service is running.";
    }
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export default api;