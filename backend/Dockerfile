# ---------- Этап 1: сборка C++ ----------
FROM debian:bookworm-slim AS cpp-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY cpp-module/ ./cpp-module/

RUN mkdir -p /src/cpp-module/build && \
    cd /src/cpp-module/build && \
    cmake .. && \
    cmake --build . --config Release

# ---------- Этап 2: FastAPI ----------
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app/ ./app/
COPY --from=cpp-builder /src/cpp-module/build/libplanner.so /app/lib/libplanner.so

ENV PLANNER_LIB=/app/lib/libplanner.so
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]