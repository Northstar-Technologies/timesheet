FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user early for security (before COPY)
RUN useradd --create-home appuser

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code with correct ownership (faster than chown -R)
COPY --chown=appuser:appuser . .

# Create uploads directory with correct ownership
RUN mkdir -p /app/uploads && chown appuser:appuser /app/uploads

USER appuser

# Expose port
EXPOSE 5000

# Run with Gunicorn + gevent for SSE support
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--worker-class", "gevent", "--workers", "4", "--timeout", "120", "app:create_app()"]
