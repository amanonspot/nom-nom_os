# Deploying Nom Nom OS

This describes deploying the **backend** (Django ASGI: REST + WebSockets) and the
**frontends** (Next.js PWAs: POS, Admin, KDS). Deploy artifacts are provided;
the actual deploy is left to you and your host.

## Architecture in production

```
                    ┌──────────── nginx (:80/:443) ────────────┐
   pos/admin/kds ──▶│  /static → files   /ws/ → WS   / → HTTP  │──▶ gunicorn+uvicorn (ASGI)
                    └───────────────────────────────────────────┘        │
                                                          ┌──────────────┼──────────────┐
                                                       Postgres         Redis      (Channels layer)
```

**Redis is required in production.** With multiple ASGI workers the realtime
KDS/POS broadcasts must flow through the Redis channel layer; the in-memory
layer only works single-process (dev). Setting `REDIS_URL` switches
`CHANNEL_LAYERS` to `channels_redis` automatically (see `config/settings.py`).

## Backend

```bash
cd backend
cp .env.prod.example .env.prod        # then edit secrets, hosts, CORS
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec web python manage.py migrate
docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser
```

The image (`backend/Dockerfile`) runs `gunicorn config.asgi:application` with
Uvicorn workers, serving HTTP **and** WebSockets. `deploy/nginx.conf` terminates
requests and upgrades `/ws/` connections.

TLS: put the stack behind a TLS terminator (managed load balancer, or add
Caddy/Traefik/`certbot`). WebSockets then use `wss://`.

## Frontends

Each app is a standard Next.js build. Set `NEXT_PUBLIC_API_URL` to the backend's
public origin (e.g. `https://api.your-domain.com`); the apps derive the WebSocket
URL from it (`http`→`ws`, `https`→`wss`).

```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com pnpm --filter @nomnom/pos build
NEXT_PUBLIC_API_URL=https://api.your-domain.com pnpm --filter @nomnom/admin build
NEXT_PUBLIC_API_URL=https://api.your-domain.com pnpm --filter @nomnom/kds build
```

Deploy the built apps to any static/Node host (Vercel, a container, or
`next start` behind nginx). Add each app's origin to `CORS_ALLOWED_ORIGINS`.

## Checklist

- [ ] `DJANGO_SECRET_KEY` set to a long random value; `DJANGO_DEBUG=false`.
- [ ] `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` set to real domains.
- [ ] `migrate` run; superuser created; (optional) `seed_demo` for a demo tenant.
- [ ] TLS terminating in front; `/ws/` upgrades reach the ASGI app (`wss://`).
- [ ] Postgres backups scheduled; Redis persistence as needed.
