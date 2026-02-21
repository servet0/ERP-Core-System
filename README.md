# ERP Core System

Production-grade, multi-tenant ERP platform built with Next.js 16, Prisma 7, and PostgreSQL.

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5.9 (strict mode) |
| **Database** | PostgreSQL + Prisma 7 (Driver Adapters) |
| **Auth** | NextAuth v5 (JWT, Credentials) |
| **UI** | Tailwind CSS v4, shadcn/ui, Radix UI |
| **Validation** | Zod v4 |
| **Icons** | Lucide React |

## Features

- **Multi-Tenant Architecture** — All data scoped by `organizationId`
- **Role-Based Access Control** — `ADMIN`, `SALES`, `WAREHOUSE`, `VIEWER` with permission-based route protection
- **Server Components** — Data fetched server-side via Prisma, zero client JS for read operations
- **Transactional Integrity** — `$transaction` for stock operations, sale creation, and auto-inventory provisioning
- **Dark/Light Theme** — Full theme support via `next-themes`

## Modules

| Module | Route | Description |
|---|---|---|
| Dashboard | `/` | KPI overview, system stats (admin), quick access links |
| Products | `/products` | Product catalog with SKU, pricing, stock status |
| Warehouses | `/warehouses` | Warehouse management with auto-inventory sync |
| Inventory | `/inventory` | Cross-warehouse stock levels, low stock alerts |
| Sales | `/sales` | Sale lifecycle (Draft → Approved → Cancelled), stock validation |

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/           # Protected route group
│   │   ├── page.tsx           # Dashboard
│   │   ├── products/          # Product module
│   │   │   ├── page.tsx
│   │   │   ├── _actions/      # Server actions
│   │   │   ├── _components/   # Module-specific UI
│   │   │   └── _lib/          # Prisma queries
│   │   ├── warehouses/        # Same pattern
│   │   ├── inventory/
│   │   └── sales/
│   ├── login/                 # Auth pages
│   └── layout.tsx             # Root layout
├── actions/                   # Global server actions
├── components/
│   ├── layout/                # Sidebar, Topbar
│   ├── shared/                # DataTable, DataCard, StatusBadge, etc.
│   └── ui/                    # shadcn/ui primitives
├── lib/                       # Prisma client, session, permissions, audit
├── schemas/                   # Zod validation schemas
├── services/                  # Business logic layer
└── types/                     # TypeScript interfaces
prisma/
├── schema.prisma              # Database schema
└── seed.ts                    # Sample data seeder
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and NEXTAUTH_SECRET

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).



### Database Commands

```bash
npm run db:studio      # Open Prisma Studio
npm run db:migrate     # Create/apply migration
npm run db:push        # Push schema without migration
npm run db:reset       # Reset database
npm run db:seed        # Seed sample data
```

### Production Build

```bash
npm run build
npm start
```

## Architecture

```
Browser → Middleware (proxy.ts) → Server Component → Prisma → PostgreSQL
                ↓                        ↓
          Auth check (JWT)        getUserOrganizationId()
          RBAC enforcement        Org-scoped queries
```

**Key patterns:**

- **Org isolation** — `organizationId` resolved server-side from authenticated user, never from client
- **Auto-inventory** — Creating a product auto-generates `Stock` rows for all warehouses (and vice versa)
- **Atomic stock** — Sale approval validates and decrements stock within a single `$transaction`
- **Audit logging** — All mutations logged to `AuditLog` with user, action, entity, and duration

## License

Private — All rights reserved.
