
import type {
  Analytics,
  AnswerResult,
  AuthUser,
  HistoryResponse,
  IncidentDetail,
  IncidentWeather,
  IncidentQuery,
  Marker,
  Responder,
  ResponderInfo,
  Zone,
} from '../../types/authority';

import { request } from './http';

type AuthorityDepartment =
  | 'POLICE'
  | 'MEDICAL'
  | 'FIRE'
  | 'DISASTER'
  | 'OTHER';

interface AuthorityRegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  inviteCode: string;
  badgeId?: string;
  department: AuthorityDepartment;
}

export const api = {
  // AUTHENTICATION
  login: (email: string, password: string) =>
    request<{
      user: AuthUser;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),

  // AUTHORITY REGISTRATION
  register: (data: AuthorityRegisterRequest) =>
    request<{
      user: AuthUser;
      accessToken: string;
      refreshToken: string;
    }>('/auth/register', {
      method: 'POST',
      body: data,
      auth: false,
    }),

  logout: (refreshToken: string) =>
    request('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    }),

  me: () => request<AuthUser>('/auth/me'),

  // INCIDENTS
  markers: () => request<Marker[]>('/incidents/map-markers'),

  incidents: (q: IncidentQuery) =>
    request<IncidentDetail[]>('/incidents', {
      query: q as Record<string, string | number>,
    }),

  incident: (id: string) =>
    request<IncidentDetail>(`/incidents/${id}`),

  history: (id: string) =>
    request<HistoryResponse>(`/incidents/${id}/history`),

  weatherForIncident: (id: string) =>
    request<IncidentWeather>(`/weather/incidents/${id}`),

  responderInfo: (id: string) =>
    request<ResponderInfo>(`/incidents/${id}/responder-info`),

  assignedToMe: () =>
    request<IncidentDetail[]>('/incidents/assigned/me'),

  analytics: () =>
    request<Analytics>('/incidents/analytics/summary'),

  // INCIDENT ACTIONS
  acknowledge: (id: string) =>
    request<IncidentDetail>(`/incidents/${id}/acknowledge`, {
      method: 'PATCH',
    }),

  assign: (id: string, assigneeId: string, note?: string) =>
    request<IncidentDetail>(`/incidents/${id}/assign`, {
      method: 'PATCH',
      body: { assigneeId, note },
    }),

  setStatus: (id: string, status: 'in_progress' | 'resolved', note?: string) =>
    request<IncidentDetail>(`/incidents/${id}/status`, {
      method: 'PATCH',
      body: { status, note },
    }),

  retryAi: (id: string) =>
    request(`/incidents/${id}/ai/retry`, {
      method: 'POST',
    }),

  // AUTHORITIES
  authorities: () =>
    request<Responder[]>('/users/authorities'),

  // SAFETY MAP
  nearbyZones: (lat: number, lng: number, radius: number, verifiedOnly: boolean) =>
    request<Zone[]>('/safety-map/nearby', {
      query: {
        lat,
        lng,
        radius,
        verifiedOnly: String(verifiedOnly),
      },
    }),

  // AI COPILOT
  copilot: (message: string, incidentId?: string) =>
    request<AnswerResult>('/ai/copilot', {
      method: 'POST',
      body: { message, incidentId },
    }),

  // PUSH NOTIFICATIONS
  pushKey: () =>
    request<{ enabled: boolean; publicKey: string | null }>('/push/public-key'),

  pushSubscribe: (sub: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }) =>
    request('/push/subscribe', {
      method: 'POST',
      body: sub,
    }),

  pushUnsubscribe: (endpoint: string) =>
    request('/push/subscribe', {
      method: 'DELETE',
      body: { endpoint },
    }),
};
