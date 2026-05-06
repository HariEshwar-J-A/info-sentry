# ScrapeGraphAI sidecar — Chromium + Playwright for JS-heavy pages
FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget ca-certificates fonts-liberation \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m playwright install chromium \
    && python -m playwright install-deps chromium || true

COPY app.py .

ENV PYTHONUNBUFFERED=1 \
    SCRAPEGRAPHAI_TELEMETRY_ENABLED=false

EXPOSE 8811

# Listen on all interfaces so Docker port publishing works; bind to 127.0.0.1 on the host in compose.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8811"]
