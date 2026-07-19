# Flask host for the static site + the /api mock (app.py).
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

EXPOSE 8935
CMD ["gunicorn", "--bind", "0.0.0.0:8935", "app:app"]
