# Use Python image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev gcc python3-dev musl-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Expose port
EXPOSE 8000

# Run migrations and collect static files before starting
CMD ["sh", "-c", "python manage.py migrate --no-input && python manage.py collectstatic --no-input && (python manage.py auto_release_version || echo '[version] auto_release_version failed — continuing startup') && daphne -b 0.0.0.0 -p 8000 backend.asgi:application"]
