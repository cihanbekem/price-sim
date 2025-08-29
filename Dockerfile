# ---- base image ----
    FROM python:3.12-slim AS base
    WORKDIR /app
    
    ENV PYTHONDONTWRITEBYTECODE=1 \
        PYTHONUNBUFFERED=1 \
        PIP_NO_CACHE_DIR=1
    
    # opsiyonel: build tools (bazı kütüphaneler isterse)
    RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl && rm -rf /var/lib/apt/lists/*
    
    # bağımlılıklar
    COPY requirements.txt .
    RUN pip install --no-cache-dir -r requirements.txt
    
    # uygulama kaynakları
    COPY app ./app
    COPY static ./static
    
    # güvenlik: non-root kullanıcı
    RUN useradd -u 10001 -ms /bin/bash appuser
    USER appuser
    
    # sqlite dosyası için kalıcı dizin
    VOLUME ["/data"]
    
    # DB adresi (kod bunu okumalı; aşağıda not var)
    ENV DATABASE_URL=sqlite+aiosqlite:////data/app.db
    
    EXPOSE 8000
    CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    