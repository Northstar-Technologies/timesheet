# Northstar Time Timesheet - Employee Timesheet Management

A modern timesheet management system replacing the legacy PowerApps solution. Built with Flask, vanilla JavaScript/CSS, and PostgreSQL for all Northstar employees and trainees.

## Features

### For Regular Users

- **View Timesheets** - Browse existing timesheets with status filtering
- **Create & Edit Timesheets** - Manage weekly timesheets with intuitive form interface
- **Multiple Hour Types** - Track Field Hours, Internal, Training, PTO, Unpaid Leave, and Holiday time
- **Travel & Expenses** - Mark travel status and expense claims with reimbursement details
- **File Attachments** - Upload approval documents (images/PDFs) for field hours
- **Draft Management** - Save work-in-progress timesheets and submit when ready
- **Notes & Comments** - Add context to timesheet submissions

### For Administrators

- **Dashboard View** - See all submitted timesheets across the organization
- **Approval Workflow** - Approve timesheets or request missing attachments
- **Billable/Payable Tracking** - View hour breakdowns by billing category
- **User Management** - View and filter by employee
- **Admin Notes** - Add notes to any submitted timesheet
- **Real-time Updates** - SSE notifications for new submissions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│              Vanilla JavaScript + CSS + HTML                     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Nginx (Proxy)                            │
│                   Rate Limiting + SSE Support                    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Flask + Gunicorn (gevent)                     │
│                         REST API + SSE                           │
└─────────────────────────────────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │      Redis      │  │  Microsoft 365  │
│   (Database)    │  │  (Pub/Sub SSE)  │  │   (Auth/MSAL)   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────┐
                                         │     Twilio      │
                                         │ (SMS Notifications)│
                                         └─────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Microsoft 365 tenant (Azure AD app registration)
- Twilio account (for SMS notifications)

### Deployment Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/Northstar-Technologies/timesheet.git
   cd timesheet
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Start the application**

   ```bash
   cd docker
   docker-compose up --build -d
   ```

4. **Access the application**
   ```
   http://localhost
   ```

## Configuration

```env
# Flask
SECRET_KEY=your-secret-key-change-in-production

# Database
DATABASE_URL=postgresql://timesheet:timesheet@db:5432/timesheet

# Microsoft 365 / Azure AD
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_REDIRECT_URI=http://localhost:5000/auth/callback

# Twilio (SMS Notifications)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Redis (for SSE pub/sub)
REDIS_URL=redis://redis:6379/0
```

## Timesheet Statuses

| Status           | Description                 |
| ---------------- | --------------------------- |
| `NEW`            | Draft, not yet submitted    |
| `SUBMITTED`      | Awaiting admin review       |
| `APPROVED`       | Approved by admin           |
| `NEEDS_APPROVAL` | Missing required attachment |

## Hour Types & Billing

| Hour Type    | Payable | Billable |
| ------------ | ------- | -------- |
| Field        | ✅      | ✅       |
| Internal     | ✅      | ❌       |
| Holiday      | ✅      | ❌       |
| PTO          | ✅      | ❌       |
| Training     | ❌      | ❌       |
| Unpaid Leave | ❌      | ❌       |

## Management Commands

### View Status

```bash
cd docker
docker-compose ps
```

### View Logs

```bash
docker-compose logs -f web
```

### Restart Services

```bash
docker-compose restart
```

### Stop All Services

```bash
docker-compose down
```

## Testing

**85 tests | 74% code coverage**

```bash
# Install test dependencies
pip install -r requirements-dev.txt

# Run all tests
pytest tests/ -v

# Run with coverage report
pytest tests/ --cov=app --cov-report=html

# Run specific test file
pytest tests/test_models.py -v
```

### Test Structure

| File                 | Tests | Description                               |
| -------------------- | ----- | ----------------------------------------- |
| `test_models.py`     | 21    | Models, hour calculations, business logic |
| `test_timesheets.py` | 22    | CRUD operations, entries, submit workflow |
| `test_admin.py`      | 24    | Admin endpoints, approval workflow        |
| `test_auth.py`       | 10    | Authentication, session management        |

## Tech Stack

| Component     | Technology                    |
| ------------- | ----------------------------- |
| Backend       | Flask (Python 3.11)           |
| Frontend      | Vanilla JavaScript, CSS, HTML |
| Database      | PostgreSQL 15                 |
| Cache/Pub-Sub | Redis 7                       |
| Auth          | Microsoft 365 / MSAL          |
| Notifications | Twilio SMS                    |
| Server        | Nginx + Gunicorn (gevent)     |
| Container     | Docker                        |

## License

Copyright (c) 2026 Northstar Technologies. All rights reserved.
