FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends rclone ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
# Explicit allowlist: Render secret files and workbooks never enter the image.
COPY app.py ./
COPY web/ ./web/
ENV PYTHONUNBUFFERED=1 DATA_DIR=/app/storage
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-10000} --workers 1 --threads 4 --timeout 180 app:app"]
