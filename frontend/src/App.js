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

function ProtectedPage({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading" data-testid="app-loading-state">Opening your workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function App() {
  return (
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
  );
}

export default App;
