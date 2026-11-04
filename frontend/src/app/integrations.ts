import type { AlertService, SafetyResourceService } from "../types/safetyIntegrations";
import { demoAlertService, demoSafetyResourceService } from "../services/demoIntegrationServices";
import { alertService } from "../services/alertService";
import { browserGeolocationService } from "../services/geolocationService";
import { safetyResourceService } from "../services/safetyResourceService";
import { SafetyMapRenderer } from "../components/maps/SafetyMapRenderer";
import type { SafetyMapRendererComponent } from "../components/maps/SafetyMapRenderer";
import type { IncidentService } from "../types/incidentIntegration";
import { incidentService } from "../services/incidentService";
import type { AssistantService } from "../types/assistantIntegration";
import { assistantService } from "../services/assistantService";
import type { AuthGateway } from "../features/user/auth/authGateway";
import { authService } from "../services/authService";

const demoEnabled = import.meta.env.VITE_ENABLE_SAFETY_DEMO === "true";

export const integrationConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "") || null,
  demoEnabled,
};

export const safetyIntegrations: {
  auth: AuthGateway;
  geolocation: typeof browserGeolocationService;
  resources: SafetyResourceService;
  alerts: AlertService;
  mapRenderer: SafetyMapRendererComponent;
  incidents: IncidentService;
  assistant: AssistantService;
} = {
  auth: authService,
  geolocation: browserGeolocationService,
  resources: demoEnabled ? demoSafetyResourceService : safetyResourceService,
  alerts: demoEnabled ? demoAlertService : alertService,
  mapRenderer: SafetyMapRenderer,
  incidents: incidentService,
  assistant: assistantService,
};
