import { Navigate, Route, Routes } from 'react-router-dom';
import './authority.css';
import AnalyticsPage from './analytics/AnalyticsPage';
import AssignmentsPage from './assignments/AssignmentsPage';
import { AuthorityAuthProvider, RequireAuthority } from './auth/AuthorityAuthContext';
import AuthorityLoginPage from './auth/AuthorityLoginPage';
import CopilotPage from './copilot/CopilotPage';
import DashboardPage from './dashboard/DashboardPage';
import IncidentDetailPage from './incidents/IncidentDetailPage';
import IncidentsPage from './incidents/IncidentsPage';
import AuthorityLayout from './layout/AuthorityLayout';
import LiveMapPage from './live-map/LiveMapPage';
import { LiveDataProvider } from './live/LiveDataProvider';
import AuthorityRegisterPage from './auth/AuthorityRegisterPage';

/** Mount once in the app router:  <Route path="/authority/*" element={<AuthorityRoutes />} /> */
export default function AuthorityRoutes() {
  return (
    <div className="auth-root">
      <AuthorityAuthProvider>
        <Routes>
          <Route path="login" element={<AuthorityLoginPage />} />
          <Route path="register" element={<AuthorityRegisterPage />} />
          <Route
            element={
              <RequireAuthority>
                <LiveDataProvider>
                  <AuthorityLayout />
                </LiveDataProvider>
              </RequireAuthority>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="incidents" element={<IncidentsPage />} />
            <Route path="incidents/:id" element={<IncidentDetailPage />} />
            <Route path="live-map" element={<LiveMapPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="copilot" element={<CopilotPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/authority" replace />} />
        </Routes>
      </AuthorityAuthProvider>
    </div>
  );
}
