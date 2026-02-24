# ProMaintain CMMS

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
- POST /api/seed - Seeds initial demo data

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
