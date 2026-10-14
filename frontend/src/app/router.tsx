import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { UserAppShell } from "../components/layout/UserAppShell";
import { DashboardPage } from "../features/user/dashboard/DashboardPage";
import { PlaceholderPage } from "../features/user/dashboard/PlaceholderPage";
import { LoginPage } from "../features/user/auth/LoginPage";
import { LogoutPage } from "../features/user/auth/LogoutPage";
import { RegistrationPage } from "../features/user/auth/RegistrationPage";
import { ProfilePage } from "../features/user/profile/ProfilePage";
import { SafetyMapPage } from "../features/user/safety-map/SafetyMapPage";
import { AlertsPage } from "../features/user/alerts/AlertsPage";
import { SOSPage } from "../features/user/sos/SOSPage";
import { SafetyAssistantPage } from "../features/user/safety-assistant/SafetyAssistantPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<UserAppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="logout" element={<LogoutPage />} />
          <Route path="sos" element={<SOSPage />} />
          <Route path="safety-map" element={<SafetyMapPage />} />
          <Route
            path="emergency-contacts"
            element={
              <PlaceholderPage
                title="Emergency contacts"
                description="Your personal emergency contacts will be available here once profile services are connected."
                icon="contacts"
              />
            }
          />
          <Route
            path="digital-id"
            element={
              <PlaceholderPage
                title="Digital safety ID"
                description="A private, shareable safety ID is not available yet. No personal ID details or QR code are displayed in this preview."
                icon="id"
              />
            }
          />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="safety-assistant" element={<SafetyAssistantPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
