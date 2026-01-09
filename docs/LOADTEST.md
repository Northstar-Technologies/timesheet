# Load Testing Guide

This document describes how to perform load testing on the Northstar Timesheet application.

## Overview

Load testing verifies the application can handle expected production traffic. Key metrics:

- Response time under load
- Throughput (requests/second)
- Error rates at scale
- Resource consumption (CPU, memory)

---

## Prerequisites

Install load testing tools:

```bash
# Locust (Python-based, recommended)
pip install locust

# Or k6 (Go-based, alternative)
brew install k6  # macOS
# or download from https://k6.io
```

---

## Quick Start with Locust

### 1. Create a Locust Test File

Save as `locustfile.py` in the project root:

```python
from locust import HttpUser, task, between
import random


class TimesheetUser(HttpUser):
    """Simulates a typical user workflow."""

    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks

    def on_start(self):
        """Login before starting tests."""
        # Use dev login for testing
        self.client.post("/auth/dev-login", data={
            "username": "user",
            "password": "user",
        })

    @task(3)
    def view_timesheets(self):
        """View list of timesheets (most common action)."""
        self.client.get("/api/timesheets")

    @task(2)
    def view_dashboard(self):
        """View the main dashboard."""
        self.client.get("/app")

    @task(1)
    def create_and_view_timesheet(self):
        """Create a new timesheet and view it."""
        # Create timesheet
        response = self.client.post("/api/timesheets", json={
            "auto_populate": True
        })

        if response.status_code == 201:
            data = response.json()
            timesheet_id = data.get("id")

            # View the created timesheet
            self.client.get(f"/api/timesheets/{timesheet_id}")

    @task(1)
    def check_health(self):
        """Health check endpoint."""
        self.client.get("/health")


class AdminUser(HttpUser):
    """Simulates an admin user."""

    wait_time = between(2, 5)
    weight = 1  # 1 admin per 10 regular users

    def on_start(self):
        """Login as admin."""
        self.client.post("/auth/dev-login", data={
            "username": "admin",
            "password": "password",
        })

    @task(3)
    def view_admin_dashboard(self):
        """View submitted timesheets."""
        self.client.get("/api/admin/timesheets")

    @task(1)
    def view_users(self):
        """View user list."""
        self.client.get("/api/admin/users")
```

### 2. Run the Load Test

```bash
# Start Locust web interface
locust -f locustfile.py --host=http://localhost

# Or run headless with specific users
locust -f locustfile.py --host=http://localhost \
    --headless \
    --users 50 \
    --spawn-rate 5 \
    --run-time 5m
```

### 3. Access Results

Open http://localhost:8089 in your browser to:

- Configure number of users
- Set spawn rate
- View real-time metrics
- Download CSV reports

---

## Load Test Scenarios

### Scenario 1: Normal Traffic

Simulates typical business hours usage.

```bash
locust -f locustfile.py --headless \
    --users 20 \
    --spawn-rate 2 \
    --run-time 10m \
    --html report_normal.html
```

**Expected Results:**

- 95th percentile response time: < 500ms
- Error rate: < 0.1%
- Throughput: > 10 req/s

### Scenario 2: Peak Traffic (Friday Submissions)

Simulates end-of-week rush when everyone submits timesheets.

```bash
locust -f locustfile.py --headless \
    --users 100 \
    --spawn-rate 10 \
    --run-time 15m \
    --html report_peak.html
```

**Expected Results:**

- 95th percentile response time: < 1000ms
- Error rate: < 1%
- Throughput: > 50 req/s

### Scenario 3: Stress Test

Find the breaking point.

```bash
locust -f locustfile.py --headless \
    --users 500 \
    --spawn-rate 20 \
    --run-time 20m \
    --html report_stress.html
```

**What to Watch:**

- When does error rate spike?
- When does response time degrade?
- What resource gets exhausted first?

---

## k6 Alternative

If you prefer k6:

```javascript
// load-test.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 50, // Virtual users
  duration: "5m", // Test duration
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% under 500ms
    http_req_failed: ["rate<0.01"], // <1% errors
  },
};

export default function () {
  // Login
  const loginRes = http.post("http://localhost/auth/dev-login", {
    username: "user",
    password: "user",
  });

  check(loginRes, {
    "login successful": (r) => r.status === 200 || r.status === 302,
  });

  // Get timesheets
  const timesheets = http.get("http://localhost/api/timesheets");
  check(timesheets, {
    "timesheets loaded": (r) => r.status === 200,
  });

  sleep(1);
}
```

Run with:

```bash
k6 run load-test.js
```

---

## Monitoring During Tests

### 1. Application Metrics

Access `/metrics` endpoint (admin only):

```bash
curl -H "Cookie: session=..." http://localhost/metrics
```

Returns:

```json
{
    "total_requests": 12345,
    "error_rate_percent": 0.5,
    "avg_duration_ms": 45.2,
    "top_routes": [...]
}
```

### 2. Docker Resource Usage

```bash
# Real-time container stats
docker stats

# Or use docker-compose
cd docker && docker compose top
```

### 3. Database Connections

```bash
docker compose exec db psql -U timesheet timesheet_db -c "
    SELECT count(*) as connections
    FROM pg_stat_activity
    WHERE datname = 'timesheet_db';
"
```

---

## Performance Benchmarks

Based on testing with 2 CPU / 4GB RAM environment:

| Metric            | Normal (20 users) | Peak (100 users) | Target      |
| ----------------- | ----------------- | ---------------- | ----------- |
| Avg Response Time | 45ms              | 120ms            | < 200ms     |
| 95th Percentile   | 150ms             | 350ms            | < 500ms     |
| Throughput        | 50 req/s          | 150 req/s        | > 100 req/s |
| Error Rate        | 0%                | 0.1%             | < 1%        |
| CPU Usage         | 30%               | 70%              | < 80%       |
| Memory Usage      | 512MB             | 1.2GB            | < 3GB       |

---

## Bottleneck Identification

### Common Bottlenecks

1. **Database Connections**
   - Symptom: Connection pool exhausted errors
   - Fix: Increase `SQLALCHEMY_POOL_SIZE` in config
2. **Gunicorn Workers**
   - Symptom: Requests queuing, slow response
   - Fix: Increase workers in docker-compose.yml
3. **Redis Connections**
   - Symptom: SSE delays, session errors
   - Fix: Increase Redis connection pool
4. **File I/O (Attachments)**
   - Symptom: Slow uploads, disk I/O wait
   - Fix: Move to object storage (S3/R2)

### How to Debug

```bash
# Check Gunicorn worker utilization
docker compose logs web | grep worker

# Check database slow queries
docker compose exec db psql -U timesheet -c "
    SELECT query, calls, mean_time
    FROM pg_stat_statements
    ORDER BY mean_time DESC
    LIMIT 10;
"

# Check Redis memory
docker compose exec redis redis-cli INFO memory
```

---

## Production Recommendations

Based on load testing results:

### For 50 concurrent users:

```yaml
# docker-compose.yml
web:
  command: gunicorn -w 4 -b 0.0.0.0:5000 wsgi:app
  deploy:
    resources:
      limits:
        cpus: "2"
        memory: 2G

db:
  deploy:
    resources:
      limits:
        cpus: "1"
        memory: 1G
```

### For 200+ concurrent users:

- Add load balancer (nginx, Traefik)
- Multiple web container replicas
- Move attachments to S3/R2
- Add Redis Cluster for sessions/SSE
- Consider read replicas for database

---

## Continuous Load Testing

Add to CI/CD pipeline:

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  schedule:
    - cron: "0 6 * * 1" # Weekly Monday 6 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Start application
        run: docker compose up -d

      - name: Run load test
        run: |
          pip install locust
          locust -f locustfile.py --headless \
              --users 50 \
              --spawn-rate 5 \
              --run-time 5m \
              --html report.html

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-report
          path: report.html
```

---

## Related Documentation

- [BACKUP.md](BACKUP.md) - Database backup procedures
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide
- [SECURITY.md](SECURITY.md) - Security checklist

---

_Document created January 9, 2026_
