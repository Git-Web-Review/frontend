import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { useI18n } from "./i18n/I18nProvider";
import { AppShell } from "./layout/AppShell";
import { AdminPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ReviewPage } from "./pages/ReviewPage";
import { SettingsPage } from "./pages/SettingsPage";

function ReviewIndexPage() {
  const { t } = useI18n();

  return (
    <div className="card">
      <div className="card-body text-center py-5">
        <p className="text-secondary">{t("selectReview")}</p>
        <Link className="btn btn-outline-secondary" to="/dashboard">
          {t("backToDashboard")}
        </Link>
      </div>
    </div>
  );
}

export function App() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex min-vh-100 flex-column align-items-center justify-content-center gap-3 bg-body-tertiary">
        <div className="spinner-border text-primary" role="status" />
        <span className="fw-semibold">git-web-review</span>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/review" element={<ReviewIndexPage />} />
        <Route path="/review/:reviewId" element={<ReviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}
