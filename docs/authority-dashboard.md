# Authority Dashboard (frontend/src/features/authority)

React + TypeScript (Vite). Self-contained: its own auth session (`sentinel.authority.session` in localStorage), its own API client under `services/authority/`, and CSS scoped with the `auth-` prefix, so it does not touch the user app.

## Install
```bash
cd frontend
npm install leaflet socket.io-client react-router-dom
npm install -D @types/leaflet
cp .env.example .env     # VITE_API_URL=http://localhost:5000
```
Copy into the repo (they are already laid out like the project tree):
`src/types/authority.ts`, `src/services/authority/*`, `src/features/authority/*`, `public/authority-sw.js`.

## Wire it into the router (one line)
```tsx
import AuthorityRoutes from './features/authority/routes';
// react-router <Routes>:
<Route path="/authority/*" element={<AuthorityRoutes />} />
// or object style: { path: '/authority/*', element: <AuthorityRoutes /> }
```
Open `http://localhost:5173/authority` → sign in with an authority account.

## Pages
| Route | What it does |
|---|---|
| `/authority/login` | authority-only sign in (a user account is rejected) |
| `/authority` | open / unacknowledged / assigned / in-progress counts, avg acknowledge & resolve time, "needs attention" queue |
| `/authority/incidents` | filter by status, category, date; paginated; auto-refresh on live events |
| `/authority/incidents/:id` | map + movement trail, details, timeline, acknowledge / assign / start / resolve, AI briefing (+retry), responder info (assignee only), copilot, audit trail |
| `/authority/live-map` | live markers, category filter, optional emergency-facility layer (verified-only toggle) |
| `/authority/assignments` | waiting queue with "Assign to me", my active assignments |
| `/authority/analytics` | per-day chart, by status / category, AI enrichment status |
| `/authority/copilot` | chat with optional incident context |

## Behaviour worth knowing
- **Real-time + fallback:** Socket.IO pushes minimal markers; if the socket drops the dashboard polls every 15 s, shows "Reconnecting", and after 60 s without a successful update shows a "data may be out of date" banner.
- **No personal data over sockets:** details are always fetched via REST (role-checked). The reporter's phone and medical info appear only for the assigned responder.
- **AI is optional:** every AI state (queued, working, unavailable, failed, insufficient evidence, fallback answer) is shown honestly; incident actions work regardless.
- **Contacts:** "contacts notified" is shown only when the backend confirms delivery.
- **Push alerts:** the "Enable alerts" button appears once the backend has VAPID keys (`npm run vapid:generate` in `backend/`, put them in `.env`). Needs HTTPS or localhost.
- **Browser support for push** requires the service worker `public/authority-sw.js` to be served from the site root.

## Manual test script
1. Register an authority (invite code) and a user; sign in at `/authority` as the authority.
2. As the user trigger an SOS (API or Harsh's app) → the dashboard counter and map update instantly; the tab title shows `(1)`.
3. Open it → Acknowledge → Assign to me → the reporter phone and responder info appear → Start work → Resolve.
4. Stop the backend for a minute → the badge changes to "Reconnecting" and the stale banner appears; restart → it recovers by itself.
5. Stop the AI service → the briefing panel shows "unavailable" and the incident keeps working.
