# Security & privacy (backend)

- **Authentication:** bcrypt (cost 12); short-lived access JWT; hashed, rotating refresh tokens with reuse detection; rate limits on auth, SOS creation and AI routes.
- **Authorisation:** server-side role checks + ownership checks on every route; role loaded from the DB per request and on socket connect.
- **Need-to-know:** reporter phone, medical info and emergency contacts are only returned to the *assigned* responder of an *open* incident (`/responder-info`), and each access is audited.
- **Sockets:** minimal payloads only; no names, phones, descriptions or medical data. Details via REST.
- **AI boundary:** context sent to the AI service is built by the backend and never contains name, phone, email, contacts or Digital ID. Responses are schema-validated before storing/returning. Reporters only see `userGuidance` + sources. AI output never changes status, severity or dispatch.
- **Audit trail:** register/login/failed login, incident create/view/ack/assign/status/cancel/responder-info, AI copilot queries, Digital ID share/scan, zone and alert changes.
- **Input validation:** zod on every body/query/param; unified error format, no stack traces in production.
- **Secrets:** only via environment variables; `.env` is git-ignored.
- **Other:** helmet, CORS restricted to `CLIENT_URL`, 1 MB body limit, request IDs for tracing.
