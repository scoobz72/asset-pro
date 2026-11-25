# Threat Model

## Project Overview

ProMaintain CMMS is a full-stack Computerized Maintenance Management System.
Frontend: React 19 + TypeScript + Vite. Backend: Express 5 + TypeScript.
Database: PostgreSQL via Drizzle ORM. Deployed on Replit (single port serves API
and client). The app manages users/team members, sites, locations, assets,
inventory, suppliers, maintenance jobs, templates, stock transactions, purchase
orders, asset audits, and maintenance requests.

## Assets

- **User accounts** — `users` table includes `name`, `role`, `email`, and a
  `password` column. These identify team members and their privilege level
  (Manager/Technician). Compromise enables impersonation and privilege misuse.
- **Operational/business data** — jobs, assets, inventory stock levels,
  suppliers, purchase orders (with monetary totals), audits. Tampering disrupts
  maintenance operations and can cause financial/inventory fraud.
- **Application secrets** — `DATABASE_URL` (server env only).

## Trust Boundaries

- **Browser to API** — all `/api/*` requests cross this boundary. Currently the
  server treats every request as fully trusted; there is no authentication or
  authorization layer.
- **API to PostgreSQL** — Drizzle ORM with parameterized queries; no raw SQL
  string concatenation observed, so SQL injection risk is low.
- **Public vs authenticated** — intended boundary (client has a login UI and a
  landing page) is NOT enforced server-side. The login is a client-only mockup.

## Scan Anchors

- Production entry points: `server/index.ts` (Express bootstrap),
  `server/routes.ts` (all `/api/*` routes), `server/storage.ts` (DB layer).
- Highest-risk area: `server/routes.ts` — every CRUD route is unauthenticated.
- `shared/schema.ts` — note the `password` column on `users` and the unused
  `insert*Schema` Zod validators (defined but never applied in routes).
- Client `client/src/pages/auth.tsx` is a mockup login (no server call); do not
  treat it as a real auth control.
- `passport`, `passport-local`, `express-session` are dependencies but are NOT
  imported or used anywhere in `server/`.

## Threat Categories

### Spoofing / Broken Authentication
There is no server-side authentication. Any anonymous internet client can call
every `/api/*` endpoint. The system cannot establish or trust a caller identity.
Guarantee required: all state-changing and private-data endpoints MUST require a
verified server-side session/identity.

### Elevation of Privilege / Broken Access Control
No authorization checks exist on any route. Users, roles, jobs, inventory, and
purchase orders can be read, created, modified, or deleted by anyone.
`POST/PATCH /api/users` accept raw `req.body`, allowing mass assignment of
`role` (privilege escalation) and `password`.

### Information Disclosure
`GET /api/users` returns all columns including `password`. The request logger in
`server/index.ts` serializes full JSON responses (including user records) to
logs, exposing credentials/PII.

### Tampering
Purchase order totals, inventory stock, job statuses and assignments are all
writable without authorization, enabling fraud and operational disruption.

### Denial of Service
No rate limiting; `POST /api/seed` and unbounded create endpoints are reachable
unauthenticated. Lower priority relative to the access-control gaps above.
