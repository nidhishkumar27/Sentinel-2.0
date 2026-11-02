export type Category = 'medical' | 'police' | 'fire' | 'other';
export type Status = 'created' | 'acknowledged' | 'assigned' | 'in_progress' | 'resolved' | 'cancelled';
export type Severity = 'critical' | 'high' | 'medium';
export type AiStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'user' | 'authority';
  badgeId?: string;
  department?: 'POLICE' | 'MEDICAL' | 'FIRE' | 'DISASTER' | 'OTHER';
}

/** Minimal data used for lists, the map and socket events. Contains no personal data. */
export interface Marker {
  id: string;
  reference: string;
  category: Category;
  severity: Severity;
  status: Status;
  location: { lat: number; lng: number } | null;
  accuracyM: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiSource {
  id?: string;
  title: string;
  documentType?: string;
  section?: string;
  url?: string;
  score?: number;
}

export interface Briefing {
  summary: string;
  procedures: { title: string; steps: string[]; sourceId?: string }[];
  nextSteps: string[];
  userGuidance: string[];
  uncertainties: string[];
  sources: AiSource[];
  insufficientEvidence: boolean;
  model?: string;
  generatedAt?: string;
  disclaimer?: string;
}

export interface TimelineEntry {
  status: string;
  action?: string;
  note?: string;
  by?: string;
  at: string;
}

export interface IncidentDetail extends Marker {
  description: string | null;
  additionalInfo: { text: string; at: string }[];
  address: string | null;
  clientTimestamp: string | null;
  reporter: { id: string; name?: string; phone?: string };
  contactVisible: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  assignedTo: { id: string; name?: string; badgeId?: string } | null;
  assignedAt: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  timeline: TimelineEntry[];
  trail: { coordinates: number[]; accuracyM?: number; at: string }[];
  contactNotification: { status: string; total?: number; inApp?: number; sms?: number };
  ai: {
    status: AiStatus;
    attempts: number;
    requestedAt: string | null;
    completedAt: string | null;
    error: { code?: string; message?: string } | null;
    briefing: Briefing | null;
  };
}

export interface Responder {
  _id: string;
  name: string;
  email: string;
  phone: string;
  badgeId?: string;
}

export interface ResponderInfo {
  reporter: { name: string; phone: string };
  medical: { bloodGroup?: string; allergies?: string[]; conditions?: string[] } | null;
  emergencyContacts: { name: string; phone: string; relationship?: string }[];
}

export interface HistoryResponse {
  reference: string;
  timeline: TimelineEntry[];
  audit: { _id: string; action: string; actorRole?: string; createdAt: string; meta?: Record<string, unknown> }[];
}

export interface Analytics {
  openIncidents: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  perDay: { date: string; count: number }[];
  avgAcknowledgeMinutes: number | null;
  avgResolutionMinutes: number | null;
  aiEnrichment: Record<string, number>;
}

export interface Zone {
  _id: string;
  name: string;
  category: string;
  verified: boolean;
  source?: string;
  distanceM?: number;
  phone?: string;
  location: { coordinates: [number, number] };
}

export interface AnswerResult {
  answer: string;
  sources: AiSource[];
  insufficientEvidence: boolean;
  suggestedActions: string[];
  fallback: boolean;
  disclaimer?: string;
  generatedAt?: string;
}

export interface IncidentQuery {
  page?: number;
  limit?: number;
  status?: Status | '';
  category?: Category | '';
  from?: string;
  to?: string;
  updatedAfter?: string;
}

export interface IncidentWeather {
  incidentId: string;
  address: string | null;
  location: { lat: number; lng: number };
  current: {
    temperatureC: number;
    apparentC: number;
    precipitationMm: number;
    windSpeedKmh: number;
    windGustKmh: number;
    weatherCode: number;
    summary: string;
  };
  hourlyForecast: {
    time: string;
    temperatureC: number;
    precipitationMm: number;
    precipitationProbability: number;
    weatherCode: number;
    summary: string;
    windSpeedKmh: number;
    windGustKmh: number;
  }[];
  dailyForecast: {
    date: string;
    weatherCode: number;
    summary: string;
    temperatureMaxC: number;
    temperatureMinC: number;
    precipitationSumMm: number;
    precipitationProbabilityMax: number;
    windSpeedMaxKmh: number;
    windGustMaxKmh: number;
  }[];
  advisories: WeatherNotice[];
  forecastRisks: WeatherNotice[];
  riskLevel: string;
  timezone: string;
  source: { name: string; url: string; note: string };
  fetchedAt: string;
  officialWarnings: {
    status: string;
    items: WeatherNotice[];
    message: string;
  };
  stale: boolean;
  ageMinutes: number;
}

export interface WeatherNotice {
  id?: string;
  type?: string;
  severity?: string;
  title: string;
  message: string;
  origin?: string;
  basis?: {
    metric?: string;
    value?: number;
    threshold?: number;
  };
}
