import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(false);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("auth:session_expired", handleSessionExpired);
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;

    if (!token && !refreshToken) {
      setUser(false);
      setLoading(false);
      return;
    }

    api.get("/api/v1/auth/me", { timeout: 8000 })
      .then((response) => {
        if (response.data && typeof response.data === "object" && response.data.email) {
          setUser(response.data);
        } else {
          setUser(false);
        }
      })
      .catch(() => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
        setUser(false);
      })
      .finally(() => setLoading(false));

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("auth:session_expired", handleSessionExpired);
      }
    };
  }, []);

  const value = {
    user,
    loading,
    setUser,
    logout: async () => {
      try {
        await api.post("/api/v1/auth/logout");
      } catch (_) {
        // ignore network error on logout
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
      setUser(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}