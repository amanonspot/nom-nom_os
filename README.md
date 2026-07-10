# Nom Nom OS

An **offline-first Restaurant OS**: local-first POS, KOT/KDS printing, menu with complex
variants, table management, CRM, expenses, GST reports, QR self-ordering, and a device-bound
license/subscription system — syncing to a cloud API.

## Architecture

- **Backend** (`backend/`): Python 3 + Django + DRF, Channels (WebSockets), Celery + Redis,
  PostgreSQL (cloud). Push/pull sync API with last-write-wins + soft-delete tombstones.
- **Frontends** (`apps/`): Next.js/React PWAs — `pos`, `kds`, `waiter`, `qr`, `admin`.
  Offline-first via IndexedDB + service worker + an outbox sync queue.
- **Shared** (`packages/`): `types` (generated from DRF OpenAPI), `sync-client` (outbox +
  push/pull worker behind a persistence port), `persistence-idb`, `ui` (design system).
- **Desktop** (`desktop/`): Tauri v2 shell with local SQLite + native thermal printing (Phase 6).

See the phased build plan for milestone scope.

## Prerequisites

- Node ≥ 20 and **pnpm** (`npm i -g pnpm`)
- Python ≥ 3.11
- Docker (for local Postgres + Redis)

## Getting started

```bash
# 1. Infra
docker compose -f backend/docker-compose.yml up -d

# 2. Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate && python manage.py runserver

# 3. Frontends
pnpm install
pnpm dev
```

## Repository layout

```
backend/    Django project (config + apps: accounts, catalog, operations, finance, sync, licensing, realtime)
apps/       Next.js PWAs (admin, pos, kds, waiter, qr)
packages/   Shared TS (types, sync-client, persistence-idb, ui)
desktop/    Tauri v2 shell (Phase 6)
```
