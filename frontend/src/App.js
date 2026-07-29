import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import AppShell from "./components/AppShell";
import BatchesPage from "./pages/BatchesPage";
import ClientsPage from "./pages/ClientsPage";
import DashboardPage from "./pages/DashboardPage";
import FinancesPage from "./pages/FinancesPage";
import LoginPage from "./pages/LoginPage";
import RemindersPage from "./pages/RemindersPage";
import SettingsPage from "./pages/SettingsPage";

import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Divine Yoga UI error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "48px 24px", fontFamily: "sans-serif", textAlign: "center", maxWidth: "600px", margin: "60px auto" }}>
          <h2 style={{ color: "#4a5d23" }}>Divine Yoga Studio</h2>
          <p style={{ color: "#6b6a65", fontSize: "15px" }}>An unexpected interface error occurred.</p>
          <div style={{ background: "#fff0eb", border: "1px solid #e07a5f", color: "#ac4932", padding: "14px", borderRadius: "6px", fontSize: "13px", textAlign: "left", wordBreak: "break-word" }}>
            {this.state.error?.message || this.state.error?.toString() || "Unknown rendering error"}
          </div>
          <p style={{ color: "#6b6a65", fontSize: "12px", marginTop: "16px" }}>
            If you just deployed on Vercel, make sure <code>REACT_APP_BACKEND_URL</code> is set in Vercel Environment Variables.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: "16px", padding: "10px 22px", background: "#4a5d23", color: "#fff", border: 0, borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedPage({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading" data-testid="app-loading-state">Opening your workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />
            <Route path="/clients" element={<ProtectedPage><ClientsPage /></ProtectedPage>} />
            <Route path="/batches" element={<ProtectedPage><BatchesPage /></ProtectedPage>} />
            <Route path="/finances" element={<ProtectedPage><FinancesPage /></ProtectedPage>} />
            <Route path="/reminders" element={<ProtectedPage><RemindersPage /></ProtectedPage>} />
            <Route path="/settings" element={<ProtectedPage><SettingsPage /></ProtectedPage>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
