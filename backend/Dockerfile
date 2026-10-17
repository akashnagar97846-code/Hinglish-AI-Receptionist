FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements-web.txt ./requirements-web.txt
RUN pip install --upgrade pip && pip install -r requirements-web.txt

COPY api.py ./api.py

EXPOSE 10000

CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-10000}"]
