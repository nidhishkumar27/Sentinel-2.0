# Sentinel 2.0 — Backend API

Base URL `/api/v1` · JSON · `Authorization: Bearer <accessToken>` · Every response carries `X-Request-Id`.

## Response format
```json
{ "success": true, "data": { }, "meta": { } }
{ "success": false, "error": { "code": "INVALID_TRANSITION", "message": "…", "details": { } }, "requestId": "…" }
```
Common codes: `VALIDATION_FAILED` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `INVALID_TRANSITION` / `CONFLICT` 409 · `NOT_ASSIGNEE` 403 · `AI_UNAVAILABLE` 503 · `AI_INVALID_RESPONSE` 502 · `WEATHER_UNAVAILABLE` 503. Timestamps are ISO-8601 UTC. IDs are 24-char hex strings. Paginated lists return `meta.{page,limit,total}`.

## Roles
| Role | Can |
|---|---|
| `user` | own profile, contacts, Digital ID, create/track/cancel own incidents, assistant, map, alerts, weather |
| `authority` | everything operational: list/filter incidents, acknowledge, assign, update status, analytics, zones, alerts, copilot. Reporter phone / medical info only for the **assigned** responder, while the incident is open. |

Authorisation is enforced on the server for every route. Role is read from the database, not trusted from the token.

## Auth
| | |
|---|---|
| POST `/auth/register` | `{name,email,phone,password,inviteCode?,badgeId?}` → `{user, accessToken, refreshToken}` |
| POST `/auth/login` | `{email,password}` → same |
| POST `/auth/refresh` | `{refreshToken}` → new pair (rotation; reuse revokes the session) |
| POST `/auth/logout` | `{refreshToken}` |
| POST `/auth/logout-all` | revoke every session |
| GET `/auth/me` | |
Access token 15 min, refresh token 7 days (configurable).

## Incident lifecycle
```
created → acknowledged → assigned → in_progress → resolved
   │            │            ▲  │         │
   │            │            └──┘ (re-assign, also from in_progress)
   └──────┬─────┘
          ▼
      cancelled (reporter only; from created / acknowledged / assigned)
```
Allowed transitions: `created→{acknowledged,assigned,cancelled}` · `acknowledged→{assigned,resolved,cancelled}` · `assigned→{assigned,in_progress,resolved,cancelled}` · `in_progress→{assigned,resolved}` · `resolved`, `cancelled` are final.
Rules: assigning implies acknowledging · once assigned only the assignee can start/resolve · changes are compare-and-set (racing responders get `409 CONFLICT`) · every change is written to `timeline` and the audit log.
Categories: `medical | police | fire | other`. Severity is derived from category by fixed rules (never from user input or AI).
The SOS response reflects what the backend stored: `201` = recorded; `200 + meta.duplicate:true` = an open incident of that category (or the same `clientRequestId`) already exists.

## Incidents
User:
| | |
|---|---|
| POST `/incidents` | `{category, description?, lat, lng, accuracyM?, address?, clientTimestamp?, clientRequestId?}` → reporter view incl. `reference`, `status`, `contactNotification.status`, `ai.status` |
| GET `/incidents/mine?status=&page=&limit=` | |
| GET `/incidents/:id` | own incident (reporter view: no responder identity, no internal notes) |
| POST `/incidents/:id/details` | `{text}` add information while open |
| POST `/incidents/:id/location` | `{lat,lng,accuracyM?}` live location |
| PATCH `/incidents/:id/cancel` | |

Authority:
| | |
|---|---|
| GET `/incidents` | filters: `status, category, from, to, lat+lng+radiusKm, updatedAfter, page, limit` |
| GET `/incidents/map-markers` | minimal markers for all open incidents |
| GET `/incidents/assigned/me` | |
| GET `/incidents/analytics/summary` | open count, by status/category, per day, avg acknowledge/resolution minutes, AI enrichment stats |
| GET `/incidents/:id` | operational view (audited) |
| PATCH `/incidents/:id/acknowledge` | |
| PATCH `/incidents/:id/assign` | `{assigneeId, note?}` |
| PATCH `/incidents/:id/status` | `{status: in_progress|resolved, note?}` |
| GET `/incidents/:id/responder-info` | reporter phone, Digital ID medical fields, emergency contacts — assignee only, open incidents only, audited |
| GET `/incidents/:id/history` | timeline + audit trail |
| POST `/incidents/:id/ai/retry` | re-run the AI briefing |

`contactNotification.status`: `pending | no_contacts | sent | partial | unavailable | failed`. The UI must only say "contacts notified" for `sent`/`partial`.
`ai.status`: `pending | processing | completed | failed | unavailable`. For the reporter, `ai.guidance` is filled only when `completed`; the SOS is valid regardless of AI state.

## Other modules
| | |
|---|---|
| GET/POST `/emergency-contacts`, PUT/DELETE `/:id` | user, max 5 |
| GET/PUT `/digital-id/me`, POST/DELETE `/digital-id/me/share` | user. Share link default 24 h |
| GET `/digital-id/verify/:token` | public, rate-limited, life-saving fields only |
| GET `/safety-map/nearby?lat&lng&radius&category&verifiedOnly=true` | facilities/zones nearest-first with `distanceM`, `verified`, `source` |
| GET `/safety-map/heatmap?days=` | anonymised density |
| POST/DELETE `/safety-map/zones` | authority |
| GET `/alerts?lat&lng` · POST `/alerts` · DELETE `/alerts/:id` | list any; manage authority |
| GET `/weather?lat&lng` | `current`, derived `advisories[]`, `source`, `providerTime`, `fetchedAt`, `stale`, `ageMinutes`. If `stale:true` show "may be outdated". |
| GET `/notifications` · PATCH `/notifications/read-all` · PATCH `/notifications/:id/read` | |
| POST `/ai/assistant` | user: `{message, lat?, lng?}` |
| POST `/ai/risk` | `{lat,lng}` advisory only |
| POST `/ai/copilot` | authority: `{message, incidentId?}` |
| GET/PATCH `/users/me`, PATCH `/users/me/location`, GET `/users/authorities` | |

## Socket.IO
Connect: `io(URL, { auth: { token: accessToken } })`. Every event is `{ v:1, serverTime, data }`.
Rooms are server-assigned: `user:<id>` and `authorities`.

| Event | To | `data` |
|---|---|---|
| `incident:created` | authorities | marker `{id,reference,category,severity,status,location,accuracyM,createdAt,updatedAt}` |
| `incident:updated` | authorities | marker |
| `incident:updated` | reporter | `{id,reference,status,responderAssigned,updatedAt}` |
| `incident:location` | authorities | `{id,lat,lng,accuracyM,at}` |
| `incident:ai_updated` | authorities + reporter | `{id,reference,aiStatus}` |
| `incident:contacts_updated` | reporter | `{id,contactNotification}` |
| `notification:new` | recipient | `{id,type,title,createdAt}` |
| `alert:new` / `alert:closed` | everyone | alert / `{id}` |

No personal data is ever sent over sockets. On any event, fetch details via REST. **Fallback:** if the socket disconnects, poll `GET /incidents?updatedAfter=<last serverTime>` (authority) or `GET /incidents/:id` (user). Treat data as stale if no event/poll succeeded for ~60 s.

---
## Added in v3

### Geocoding (OpenStreetMap Nominatim, cached 24 h, throttled to 1 req/s)
| | |
|---|---|
| GET `/geo/reverse?lat&lng` | coordinates → `{label, address{}}` (or `null`) |
| GET `/geo/search?q&limit` | text → `[{label, lat, lng, type}]` (q ≥ 3 chars) |
Provider down → `503 GEOCODER_UNAVAILABLE`. After every SOS the backend also fills `incident.address` in the background (best effort, never blocks the SOS) and emits `incident:updated`.

### Emergency facilities
| | |
|---|---|
| POST `/safety-map/import` | authority: `{lat,lng,radiusM(500–20000),verify?}` imports hospitals, clinics, police, fire stations and shelters from OpenStreetMap. Idempotent. Rows are **unverified** unless `verify:true`. 5 calls/hour. Source down → `503 FACILITY_SOURCE_UNAVAILABLE` |
| GET `/safety-map/zones?verified&category&page` | authority review queue (includes unverified) |
| PATCH `/safety-map/zones/:id/verify` | authority |
| POST `/safety-map/zones/verify-bulk` | authority: `{source:"osm", category?}` |
CLI: `npm run seed:facilities -- --lat <lat> --lng <lng> --radius 10000 [--verify]`.
Only **verified** facilities reach users and the AI context by default (`verifiedOnly=true`).

### Push notifications (Web Push / VAPID)
| | |
|---|---|
| GET `/push/public-key` | `{enabled, publicKey}`; `enabled:false` when VAPID keys are not configured |
| POST `/push/subscribe` | `{endpoint, keys:{p256dh, auth}}` |
| DELETE `/push/subscribe` | `{endpoint}` |
Every in-app notification also goes out as a push. Payloads are non-sensitive (title, short body, incident id/url). Authorities get `data.url = /authority/incidents/<id>`. Dead subscriptions (404/410) are deleted automatically.
