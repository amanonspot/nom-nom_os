# Production image for the Nom Nom OS backend (ASGI: HTTP + WebSockets).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for psycopg + building wheels.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt gunicorn uvicorn[standard]

COPY . .

# Collect static assets at build time (admin, DRF browsable API).
RUN DJANGO_SECRET_KEY=build DJANGO_DEBUG=false python manage.py collectstatic --noinput || true

EXPOSE 8000

# Gunicorn with Uvicorn workers serves the ASGI app (Channels WebSockets + HTTP).
CMD ["gunicorn", "config.asgi:application", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8000", \
     "--workers", "3"]
