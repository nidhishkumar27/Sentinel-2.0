# Sentinel user frontend

The user-facing React app lives in this existing Vite project. From this
directory, install dependencies and start the development server:

```sh
npm install
npm run dev
```

Run the strict TypeScript check and production build with:

```sh
npm run typecheck
npm run build
```

## Phase 1 preview

The dashboard is a UI preview. Dashboard resource and alert cards are explicitly
marked demo examples; they are not live, verified, or location-specific data.
Mapping, SOS submission, personal contacts, digital ID, alerts, and the Safety
Assistant are not connected to backend or AI services. The SOS screen now
provides a request review flow, but its default incident adapter is unavailable
and cannot contact emergency services. Do not rely on this preview for
emergency assistance or current local safety information.

Dashboard sample resources and alerts are hidden unless
`VITE_ENABLE_SAFETY_DEMO=true`. They are illustrative only when enabled.

## Phase 2 account screens

Login, registration, profile, and sign-out screens are available, but the
backend auth modules and shared API contracts are still placeholders. The
frontend auth gateway in `src/features/user/auth/authGateway.ts` defines the
integration boundary; `src/services/authService.ts` intentionally returns an
unavailable result until a coordinated backend adapter is provided. No endpoint
or token mechanism is assumed. The app does not persist passwords, tokens, or
profile details in browser storage. Account operations and profile details
therefore remain unavailable unless a real gateway is explicitly wired into
`src/app/integrations.ts` as `safetyIntegrations.auth`.
Gateway adapters should translate transport failures and timeouts into explicit
`AuthResult` failures; the UI displays a safe error and does not infer success.

The shapes in `src/types/auth.ts` are frontend adapter types, not agreed
backend request or response contracts. Coordinate their mapping with the
backend owner before implementing a live adapter.

## Phase 3 map and alerts integrations

Map, resource, geolocation, and alert interfaces are frontend-only types in
`src/types/safetyIntegrations.ts`. Selectable implementations and configuration
live in `src/app/integrations.ts`. The default resource/alert adapters report
unavailable, and the map renderer explicitly reports that no provider is
connected. Browser geolocation runs only after a user action; the page holds
coordinates in component memory and only calls the resource service after a
separate user action.

`VITE_API_BASE_URL` is an optional future base URL only; no endpoint is assumed
or called. `VITE_ENABLE_SAFETY_DEMO=true` opts into isolated demo adapters, which
return empty resource/alert lists and do not create sample locations or current
alerts. It is disabled by default. For real integration, coordinate backend
contracts first, implement adapters that satisfy the frontend interfaces, and
select them centrally in `src/app/integrations.ts`. A map provider can be
integrated by implementing `SafetyMapRendererProps` and selecting that renderer
in the same file; the page does not depend on a specific mapping library.

## Phase 4 SOS integration

`src/types/incidentIntegration.ts` defines frontend-only incident request,
confirmation, result, and service types. `src/services/incidentService.ts`
provides the default unavailable adapter, selected centrally as
`safetyIntegrations.incidents` in `src/app/integrations.ts`. No incident
endpoint or backend status contract is assumed. A future backend adapter must
map only explicit service confirmations/rejections and preserve unknown
outcomes after timeouts or connection loss. The SOS page never retries an
unknown submission. AI and other services are not part of the submission path.

## Phase 5 AI Safety Assistant integration

`src/types/assistantIntegration.ts` defines frontend-only question, response,
citation, and outcome types; these are not shared API contracts. The assistant
service is selected centrally as `safetyIntegrations.assistant` in
`src/app/integrations.ts`. Its default adapter in
`src/services/assistantService.ts` reports unavailable and makes no network
request. No provider, endpoint, authentication, or AI response schema is
assumed.

The Safety Assistant keeps its conversation in page memory only. It displays
answer text and citations only when supplied by a configured adapter, and
validates citation links to HTTP(S) before rendering them as links. The
assistant is not an emergency service; users in immediate danger should
contact local emergency services directly. Coordinate a frontend adapter
mapping with the AI service owner before connecting the future AI engine.

## Phase 6 setup and checks

Use Node.js and npm versions supported by the installed Vite toolchain. From
this directory:

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

The automated tests use Vitest, jsdom, React Testing Library, and
`user-event`. They use local mock adapters and browser DOM emulation; they do
not call backend, AI, location, or other network services. `npm run build`
includes a TypeScript check before creating the production bundle.

### Frontend adapter handoff

Every type below is frontend-local and is **not** an agreed shared API
contract. The UI should continue to depend on these interfaces while adapters
translate coordinated team contracts into and out of them. Replace adapters in
`src/app/integrations.ts` (auth is selected there and passed to `AuthProvider`;
other integrations are selected there directly), without adding transport code
to page components.

| Integration | Frontend interface/types | Current default | Real adapter must provide | Team decisions before connection |
| --- | --- | --- | --- | --- |
| Authentication/session | `AuthGateway` in `src/features/user/auth/authGateway.ts`; user/result types in `src/types/auth.ts` | `authService` returns unavailable; no session is inferred | Current-session lookup, sign-in, registration, sign-out outcomes | Endpoint/request and response mapping, session mechanism, expiry/refresh, verification flow, authorization, timeout policy and safe error mapping |
| Browser geolocation | `GeolocationService` and location types in `src/types/safetyIntegrations.ts` | `browserGeolocationService` calls browser geolocation only after a user action | Browser API implementation or an agreed alternative; permission/timeout/error outcomes | Whether/how a location may be transmitted, precision/retention, consent, and applicable permissions |
| Safety resources/map | `SafetyResourceService`, coordinates/resources and map-renderer props in `src/types/safetyIntegrations.ts` and `src/components/maps/SafetyMapRenderer.tsx` | Resource service and map renderer report unavailable | Verified resource results and explicit empty/unavailable/timeout/error outcomes; a renderer/provider selected centrally | Resource source/verification, freshness, search radius, coordinate handling, map provider/tiles and terms |
| Alerts | `AlertService`, `SafetyAlert`, `AlertFeed` in `src/types/safetyIntegrations.ts` | `unavailableAlertService` reports unavailable; opt-in demo adapter returns an empty feed | Alerts, source, timestamps, freshness and explicit empty/unavailable/timeout/error outcomes | Source authority, geographic scope, freshness semantics, severity/category mapping and timeout policy |
| SOS incidents | `IncidentService`, request/result types in `src/types/incidentIntegration.ts` | `unavailableIncidentService` reports unavailable and makes no request | Explicit confirmed, rejected, unavailable, or ambiguous submission outcomes; confirmed reference/status only when returned | Submission semantics, confirmation meaning, idempotency/reconciliation after timeout, whether status tracking is supported and its lifecycle/transport, location handling, authorization and escalation wording |
| AI Safety Assistant | `AssistantService` and request/response/citation/outcome types in `src/types/assistantIntegration.ts` | `unavailableAssistantService` reports unavailable and makes no request | Answer/evidence outcome and genuine source metadata when supplied | AI owner/API mapping, authentication, evidence/insufficient-evidence semantics, citation trust/validation, safety escalation and data retention |

`VITE_API_BASE_URL` is only a future base URL; no endpoint is constructed from
it. `VITE_ENABLE_SAFETY_DEMO` defaults to `false`. It opts in to the isolated,
empty demo resource/alert adapters and the dashboard's clearly marked sample
cards. There is no demo auth, SOS, or AI implementation. Never use demo values
as evidence of live service behavior.

Service interfaces expose timeout outcomes where appropriate, but adapters
must enforce and map their own transport timeout policy; the UI cannot cancel
an unspecified future transport.

### Integration sequence

1. Service owners agree API behavior in team-owned contracts; this frontend
   does not dictate those contracts.
2. Implement an adapter in `src/services/` that maps the agreed transport
   contract to the corresponding frontend interface and maps raw failures to
   safe, explicit outcomes.
3. Select the adapter in `src/app/integrations.ts`; keep page components free
   of endpoint, token, and transport details.
4. Add adapter tests for confirmed and ambiguous outcomes, privacy behavior,
   timeouts, and error mapping. Preserve the unavailable default until the
   adapter is intentionally selected.
5. Verify behavior and user-facing language with the service owner before
   describing any backend action as confirmed.

No real backend or AI adapter is configured. Contacts and Digital ID remain
placeholder pages, and no service in this preview contacts emergency
responders. The current incident interface supports submission only; no
incident status polling or subscription interface exists yet.
