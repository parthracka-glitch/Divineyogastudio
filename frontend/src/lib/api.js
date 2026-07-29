import axios from "axios";

const rawBackendUrl = process.env.REACT_APP_BACKEND_URL || "";
const backendUrl = rawBackendUrl.trim().replace(/\/+$/, "");

const api = axios.create({
  baseURL: backendUrl || undefined,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => {
    if (typeof response.data === "string" && response.data.trim().toLowerCase().startsWith("<!doctype html")) {
      return Promise.reject(new Error("Received HTML fallback from server instead of JSON. Ensure REACT_APP_BACKEND_URL is set correctly in Vercel."));
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export function formatApiError(error) {
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(" ");
  if (error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export default api;