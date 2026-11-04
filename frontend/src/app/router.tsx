import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { UserAppShell } from "../components/layout/UserAppShell";
import { DashboardPage } from "../features/user/dashboard/DashboardPage";
import { LoginPage } from "../features/user/auth/LoginPage";
import { LogoutPage } from "../features/user/auth/LogoutPage";
import { RegistrationPage } from "../features/user/auth/RegistrationPage";
import { ProfilePage } from "../features/user/profile/ProfilePage";
import { SafetyMapPage } from "../features/user/safety-map/SafetyMapPage";
import { AlertsPage } from "../features/user/alerts/AlertsPage";
import { SOSPage } from "../features/user/sos/SOSPage";
import { SafetyAssistantPage } from "../features/user/safety-assistant/SafetyAssistantPage";
import { RequireUser } from "./RequireUser";
import { HomePage } from "../features/home/HomePage";
import { EmergencyContactsPage } from "../features/user/contacts/EmergencyContactsPage";
import AuthorityRoutes from "../features/authority/routes";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/authority/*" element={<AuthorityRoutes />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route element={<UserAppShell />}>
          <Route path="user" element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="logout" element={<LogoutPage />} />
          <Route path="sos" element={<RequireUser><SOSPage /></RequireUser>} />
          <Route path="safety-map" element={<RequireUser><SafetyMapPage /></RequireUser>} />
          <Route
            path="emergency-contacts"
            element={
              <RequireUser><EmergencyContactsPage /></RequireUser>
            }
          />
          <Route path="alerts" element={<RequireUser><AlertsPage /></RequireUser>} />
          <Route path="safety-assistant" element={<RequireUser><SafetyAssistantPage /></RequireUser>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
