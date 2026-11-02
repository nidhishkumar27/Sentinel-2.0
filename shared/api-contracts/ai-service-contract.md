# Backend ⇄ AI Engine contract (v1) — to be agreed with Nidhish

Transport: HTTPS JSON. Header `x-api-key: <AI_ENGINE_API_KEY>` (service-to-service) and `x-request-id`.
Timeout 20 s (configurable). Backend retries `503/network` with exponential backoff (max 3). Paths are centralised in `backend/src/services/aiEngine.client.ts → AI_PATHS`.

The backend **never** sends the reporter's name, phone, email, contacts or Digital ID. Anything not in `context` is unknown and must not be invented.

## 1. POST `/api/v1/briefing` — SOS briefing (background, optional)
Request `{ "context": IncidentContext }`
```json
{
  "schemaVersion": "1.0",
  "incident": { "id": "…", "reference": "SNT-20261014-K7M2QX", "category": "medical|police|fire|other",
    "severity": "critical", "status": "created", "createdAt": "ISO", "deviceTimestamp": "ISO|null",
    "description": "string|null", "additionalInfo": [{ "text": "…", "at": "ISO" }] },
  "location": { "lat": 12.91, "lng": 74.85, "accuracyM": 12 },
  "nearbyResources": [{ "name": "…", "category": "hospital", "distanceM": 850, "phone": "…|null", "verified": true }],
  "weather": { "summary": "Rain", "current": {}, "advisories": [], "providerTime": "ISO", "stale": false, "source": "Open-Meteo" } ,
  "unknown": ["description_or_symptoms", "location_accuracy", "weather", "nearby_verified_facilities"]
}
```
Response (validated by `briefingSchema`; unknown fields are dropped; invalid → stored as `failed`)
```json
{
  "summary": "based only on supplied facts",
  "procedures": [{ "title": "…", "steps": ["…"], "sourceId": "doc-12" }],
  "nextSteps": ["for authorities"],
  "userGuidance": ["safe, plain-language steps for the reporter"],
  "uncertainties": ["…"],
  "sources": [{ "id": "doc-12", "title": "…", "documentType": "sop", "section": "…", "url": "…", "score": 0.82 }],
  "insufficientEvidence": false,
  "model": "gemini-…", "generatedAt": "ISO", "disclaimer": "…"
}
```
`userGuidance` is the **only** briefing text shown to the reporter. If evidence is missing set `insufficientEvidence: true` rather than guessing.

## 2. POST `/api/v1/rag/query` — user safety assistant
Request `{ "query": "…", "context": { "audience": "user", "location": {lat,lng}|null, "openIncident": {category,status,description}|null } }`
Response `{ "answer": "…", "sources": [], "insufficientEvidence": false, "suggestedActions": [], "fallback": false, "disclaimer": "…", "generatedAt": "ISO" }`
When Gemini is unavailable the engine should return its safe fallback answer with `fallback: true`.

## 3. POST `/api/v1/risk/assess` — advisory risk
Request `{ "context": { schemaVersion, location, time, incidentsLast30DaysWithin2km, nearbyResources, activeAlerts, weather, unknown } }`
Response `{ "level": "low|medium|high|unknown", "score": 0.0-1.0|null, "signals": [{name,detail,contribution}], "deterministicRules": [{rule,triggered}], "missingData": [], "uncertainty": "…", "generatedAt": "ISO", "disclaimer": "…" }`
Advisory only: the backend never uses it for routing, severity or dispatch.

## 4. POST `/api/v1/copilot/chat` — authority copilot
Request `{ "message": "…", "context": { "audience": "authority", ...IncidentContext | "incident": null } }`
Response: same shape as §2 (`answer`, `sources`, `insufficientEvidence`, `suggestedActions`, …), grounded in retrieved SOPs + the supplied incident only.

## Errors
Non-2xx from the engine: `503/504/429/network` → backend `AI_UNAVAILABLE` (retried); other → `AI_UPSTREAM_ERROR`. Invalid body → `AI_INVALID_RESPONSE` (not retried).
