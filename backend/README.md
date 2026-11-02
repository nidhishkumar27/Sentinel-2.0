# Sentinel 2.0 — Backend (Node.js + Express + TypeScript + MongoDB)

Owner: Pannaga. Central integration point for the user app, authority dashboard and AI service.

## Setup
```bash
cp .env.example .env     # set MONGO_URI and JWT_SECRET at minimum
npm install
npm run dev              # http://localhost:5000  (GET /health)
npm test                 # unit + integration (integration uses an in-memory MongoDB)
npm run build && npm start
```
Create an authority account by registering with `inviteCode` = `AUTHORITY_INVITE_CODE`.

## Docs
- `../docs/api-documentation.md` — endpoints, roles, response format, lifecycle, Socket.IO events
- `../docs/database-schema.md` — collections and indexes
- `../docs/authority-dashboard.md` — dashboard setup, routes and behaviour
- `../docs/security.md` — privacy and access rules
- `../shared/api-contracts/ai-service-contract.md` — Backend ⇄ AI engine contract (agree with Nidhish)

## Fill the map with real facilities (once per city)
```bash
npm run seed:facilities -- --lat <lat> --lng <lng> --radius 10000          # imports as UNVERIFIED
curl -X POST localhost:5000/api/v1/safety-map/zones/verify-bulk -H "Authorization: Bearer <authority token>" \
  -H "Content-Type: application/json" -d '{"source":"osm"}'                # after you reviewed them
```
Needs internet access to OpenStreetMap's Overpass API. Only verified rows are shown to users and sent to the AI.

## Push notifications (optional)
`npm run vapid:generate` → copy the keys into `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Without them push is simply off.

## Design rules worth remembering
1. **SOS never depends on AI, weather or SMS.** `createIncident()` only touches MongoDB; enrichment runs afterwards in the background.
2. **Status changes go through one function** (`transitionIncident`) that enforces the state machine, ownership and concurrency.
3. **Controllers never return raw documents** — `incident.presenter.ts` decides who sees what.
4. **Sockets carry minimal data**; details come via REST where permissions are enforced.

## Known limitations
- Push is Web Push only (browsers/PWA). Native mobile push (FCM/APNs) is not included; SMS to non-Sentinel contacts is a stub (`notifications.service.ts → sendSms`). The incident records `contactNotification.status` honestly (`unavailable` until a provider is wired in).
- AI retry queue is in-process (state is in MongoDB and resumed on restart). Use BullMQ/Redis if you scale to several instances.
- Weather cache is in-memory per instance.
- Socket.IO with several instances needs the Redis adapter.
- Not yet run against live services in this repo state: run `npm test` first and fix any type errors `tsc` reports.

## docker-compose snippet (root)
```yaml
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: [mongo-data:/data/db]
  backend:
    build: ./backend
    env_file: ./backend/.env
    environment:
      MONGO_URI: mongodb://mongo:27017/sentinel
      AI_ENGINE_URL: http://ai-engine:8000
    ports: ["5000:5000"]
    depends_on: [mongo]
# volumes: { mongo-data: {} }
```
