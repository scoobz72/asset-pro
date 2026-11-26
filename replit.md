# myCMMS (Asset Pro)

A full-stack Computerized Maintenance Management System (CMMS) web application.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express 5 + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **State Management**: TanStack React Query

## Project Structure

```
client/src/
  pages/         - 19 page components (dashboard, jobs, assets, inventory, etc.)
  components/    - Layout + 55 shadcn/ui components
  hooks/         - use-data.ts (API hooks), use-toast.ts, use-mobile.tsx
  lib/           - queryClient.ts, utils.ts

server/
  index.ts       - Express server entry point
  routes.ts      - All API routes (/api/*)
  storage.ts     - Database storage layer (IStorage interface + DatabaseStorage)
  db.ts          - Drizzle ORM database connection

shared/
  schema.ts      - Drizzle ORM schema definitions + Zod validation
```

## Database Tables

- `users` - Team members (id serial, name, role, status, avatar, email)
- `sites` - Physical sites (id text PK)
- `locations` - Locations within sites (id text PK, siteId FK)
- `store_rooms` - Spares store rooms within sites (id text PK, siteId FK)
- `bins` - Bins within store rooms; parts point at a bin (`inventory.bin_id`)
- `assets` - Equipment/machinery (id text PK, locationId FK, status, health)
- `asset_parts` - Many-to-many asset-inventory relationship
- `inventory` - Parts/consumables (id text PK, stock, minStock, suppliers FKs)
- `suppliers` - Vendor info (id text PK, categories array, rating)
- `jobs` - Maintenance work orders (id text PK, assetId FK, assigneeId FK, priority, status)
- `templates` - Job procedure templates (id text PK, steps JSONB, signOffs array)
- `stock_transactions` - Inventory movement log
- `purchase_orders` - Vendor purchase orders
- `asset_audits` - Asset location audits
- `maintenance_requests` - User-submitted maintenance requests

## API Endpoints

All prefixed with `/api/`:
- CRUD: users, sites, locations, assets, inventory, suppliers, jobs, templates, purchase-orders, audits, maintenance-requests
- GET /api/assets/:id/parts - Asset parts relationship
- GET/POST /api/transactions - Stock transaction log
- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me - Session authentication

## Multi-company

Every table has `company_id`; record codes are unique per company (composite primary keys)
and composite foreign keys stop cross-company links. All storage methods take the signed-in
user's company (`companyOf(req)`), never a value from the request. `PlatformAdmin` users
manage companies via `/api/platform/*`; the first one is created from `ADMIN_EMAIL` /
`ADMIN_BOOTSTRAP_PASSWORD`. There is no demo seed.

## Authentication & Authorization

- Server-side sessions (express-session + Postgres `user_sessions` table) with passport-local email/password login. `SESSION_SECRET` is required.
- Every `/api/*` route except the auth routes requires a signed-in user.
- Manager/Admin only: creating/updating users, all DELETE endpoints, approving/rejecting purchase orders.
- Passwords are hashed with scrypt; user API responses never include the password column, and request logs never include response bodies.
- All create/update bodies are validated and allow-listed with the Zod schemas in `shared/schema.ts`.
- First sign-in: set the `ADMIN_BOOTSTRAP_PASSWORD` secret (optionally `ADMIN_EMAIL`). On startup, if no Manager/Admin has a password yet, it is assigned to that account (default: the first Manager, `john@promaintain.app` in the demo data). Other users get passwords via `PATCH /api/users/:id` by a Manager.

## Key Features

- Dashboard with KPIs computed from real data
- Job management with create/edit/assign/complete workflows
- Asset tracking with list view, topology map, and floor plan overlay
- Inventory management with stock tracking and low-stock alerts
- Supplier management
- Purchase order workflow with approval states
- Job templates with procedure steps
- Asset audits and stock take cycle checks
- Maintenance request portal
- Transaction/audit trail logging
