#!/bin/sh
set -e

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Seeding demo data (idempotent)..."
python manage.py seed_demo || true

echo "Collecting static files..."
python manage.py collectstatic --noinput || true

echo "Starting Gunicorn server..."
exec gunicorn fundflow.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
