# Sentinel user frontend integration

## Architecture inspected

- Backend: Express 4, TypeScript, Mongoose and Socket.IO. `src/app.ts` mounts all REST modules at `/api/v1`; `src/server.ts` connects MongoDB and initializes the socket server.
- Combined frontend: the Vite/React app at `D:\sentinel-frontend\Sentinel-2.0-feature-user-app\frontend`. User routes and the authority dashboard now run in this single app.
- No source ZIP was present in the supplied attachment directory. The user frontend source directory was available and inspected directly.

## API compatibility map

| User frontend feature | Backend endpoint | Method | Authentication | Status |
|---|---|---|---|---|
| Sign in | `/api/v1/auth/login` | POST | None | Integrated; access and refresh tokens handled |
| Register | `/api/v1/auth/register` | POST | None | Integrated; backend requires phone, now collected by UI |
| Session / profile | `/api/v1/auth/me`, `/api/v1/users/me` | GET | Bearer JWT | Session and read-only name/email profile integrated; profile editing is not in current UI |
| Sign out | `/api/v1/auth/logout` | POST | Refresh token body | Integrated |
| SOS creation | `/api/v1/incidents` | POST | User JWT | Integrated for actual categories; category is required by backend, so no-category SOS is rejected locally |
| SOS location update | `/api/v1/incidents/:id/location` | POST | User JWT | Integrated |
| Late incident description | `/api/v1/incidents/:id/details` | POST | User JWT | Integrated; appends additional info (does not replace initial description) |
| Nearby safety resources | `/api/v1/safety-map/nearby` | GET | JWT | Integrated; verified backend resources only |
| Active safety alerts | `/api/v1/alerts` | GET | JWT | Integrated; displays active authority-published alerts filtered by the selected coordinates |
| User weather | `/api/v1/weather?lat=…&lng=…` | GET | JWT | Current conditions, seven-day forecast, forecast risks and intersecting official IMD CAP warnings |
| Incident weather | `/api/v1/weather/incidents/:incidentId` | GET | Authority JWT | Backend-only; unavailable to ordinary user role by design |
| Assistant | `/api/v1/ai/assistant` | POST | User JWT | Integrated; maps backend `answer`, `sources`, and `insufficientEvidence` |
| User notifications | `/api/v1/notifications` | GET; `/read-all`, `/:id/read` PATCH | JWT | Backend exists; no notification UI adapter in the current frontend |
| Emergency contacts | `/api/v1/emergency-contacts` and `/:id` | GET/POST/PUT/DELETE | User JWT | Integrated; signup contacts load on the page and can be managed there |
| Digital ID | `/api/v1/digital-id/me`, `/me/share` | GET/PUT/POST/DELETE | User JWT | Removed from the user frontend; backend endpoints retained for existing responder workflows |
| Location geocoding | `/api/v1/geo/reverse`, `/search` | GET | JWT | Used by safety alerts for manual place search |
| Browser map renderer | None in user app; no user map dependency/provider configured | — | — | Not integrated; map provider dependency absent |
| Natural hazard feed | None | — | — | Separate earthquake/flood/landslide feeds are not configured; authority-published alerts and IMD CAP weather warnings are shown when returned |
| User socket client | Events `incident:updated`, `incident:contacts_updated`; envelope `{v,serverTime,data}` | Socket.IO | Access token in handshake | No user socket adapter currently; incident REST fallback is available |
| Push subscription | `/api/v1/push/public-key`, `/subscribe` | GET/POST/DELETE | JWT | Backend supports browser subscription; user app has no service worker or push UI |

All route names, payload keys, roles and response envelopes above were verified in backend route, middleware, schema/model and presenter source. Errors use `{ success:false, error:{code,message,details?}, requestId }`.

## Integration plan carried out

Keep the user app's current page and service boundaries. Add one typed HTTP client that reads `VITE_API_BASE_URL`, uses `/api/v1`, sends the existing JWT bearer format, rotates refresh tokens on 401, and adapts only verified backend response shapes. Wire the existing auth, incident, resource, alert and assistant services. Extend registration to collect the phone field required by backend validation and guard authenticated user routes. Leave unsupported functionality in its existing explicit unavailable or placeholder state.

## Environment and local startup

Copy `backend/.env.example` to `backend/.env`. Set `MONGO_URI` to a reachable MongoDB database and `JWT_SECRET` to a random value of at least 16 characters. Set `CLIENT_URL` to the combined frontend origin (default `http://localhost:5173`). Optional integrations use the documented AI, weather, geocoder, Overpass and VAPID settings in that file. The server exits at startup if required MongoDB or JWT configuration is invalid.

User frontend `.env.example`:

```dotenv
VITE_API_BASE_URL=http://localhost:5000
VITE_ENABLE_SAFETY_DEMO=false
```

Start from the repository root:

```powershell
cd backend
npm.cmd run dev
```

In another terminal:

```powershell
cd D:\sentinel-frontend\Sentinel-2.0-feature-user-app\frontend
npm.cmd run dev
```

Expected local URLs: backend health `http://localhost:5000/health`, API `http://localhost:5000/api/v1`, combined user and authority app `http://localhost:5173`. Authority registration is at `/authority/register`; the authority dashboard is at `/authority`.
