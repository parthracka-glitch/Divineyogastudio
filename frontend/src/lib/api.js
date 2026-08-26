import axios from "axios";

const rawBackendUrl = process.env.REACT_APP_BACKEND_URL || "";
const backendUrl = rawBackendUrl.trim().replace(/\/+$/, "");

const api = axios.create({
  baseURL: backendUrl || undefined,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

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
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      if (typeof window !== "undefined") {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            const refreshUrl = `${backendUrl || ""}/api/v1/auth/refresh`;
            const refreshResponse = await axios.post(
              refreshUrl,
              { refresh_token: refreshToken },
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${refreshToken}`,
                },
                withCredentials: true,
              }
            );

            const { access_token, refresh_token: newRefreshToken } = refreshResponse.data || {};
            if (access_token) {
              localStorage.setItem("access_token", access_token);
              if (newRefreshToken) {
                localStorage.setItem("refresh_token", newRefreshToken);
              }
              api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              processQueue(null, access_token);
              return api(originalRequest);
            }
          } catch (refreshErr) {
            processQueue(refreshErr, null);
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            window.dispatchEvent(new CustomEvent("auth:session_expired"));
            return Promise.reject(refreshErr);
          } finally {
            isRefreshing = false;
          }
        } else {
          localStorage.removeItem("access_token");
          window.dispatchEvent(new CustomEvent("auth:session_expired"));
        }
      }
    }
    return Promise.reject(error);
  }
);

export function formatApiError(error) {
  // If static hosting returned 405 (Method Not Allowed) when POSTing to the Vercel static URL
  if (error.response?.status === 405 || (!backendUrl && typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1")) {
    return "Backend URL not configured: Please add REACT_APP_BACKEND_URL (your Render backend URL) in Vercel Project Settings > Environment Variables, then Redeploy.";
  }

  const detail = error.response?.data?.detail;
  if (typeof detail === "string") {
    if (detail.toLowerCase().includes("session is invalid") || detail.toLowerCase().includes("session is no longer valid") || detail.toLowerCase().includes("sign in is required")) {
      return "Your session has expired. Please log in again to continue.";
    }
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = item.loc && item.loc.length > 1 ? item.loc.slice(1).join(".") : "";
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join("; ");
  }
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