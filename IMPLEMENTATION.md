# Timesheet Application - Implementation Plan

Replacing the PowerApps timesheet solution with a modern Flask + vanilla JS/CSS application for ~60 users.

## Screenshots

### Reference: PowerApps Current UI

![PowerApps Dashboard](docs/images/powerapps_dashboard.png)
_Current PowerApps dashboard showing sidebar navigation, timesheet list, and star logo_

![PowerApps Timesheet Detail](docs/images/powerapps_timesheet.png)
_PowerApps timesheet entry form with time grid and action buttons_

### New Implementation: Flask App

![New Dashboard](docs/images/new_dashboard.png)
_New Flask implementation with forest green theme and premium UI_

---

## System Architecture

```mermaid
graph TB
    subgraph Client
        Browser[Browser - Vanilla JS/CSS/HTML]
    end

    subgraph Docker Container
        Nginx[Nginx Reverse Proxy]
        Gunicorn[Gunicorn + gevent workers]
        Flask[Flask Application]
    end

    subgraph External Services
        MSAL[Microsoft 365 / Azure AD]
        Twilio[Twilio SMS]
    end

    subgraph Data Layer
        Postgres[(PostgreSQL)]
        Redis[(Redis - Optional Cache)]
        Uploads[File Storage]
    end

    Browser --> Nginx
    Nginx --> Gunicorn
    Gunicorn --> Flask
    Flask --> MSAL
    Flask --> Twilio
    Flask --> Postgres
    Flask --> Redis
    Flask --> Uploads
    Flask -.-> |SSE| Browser
```

## User Review Required

> [!IMPORTANT] > **File Storage Decision Pending**: Attachment storage (images/PDFs for field hours) needs to be decided. Options:
>
> - Local filesystem (Docker volume) - simpler, but requires backup strategy
> - Azure Blob Storage - scales better, integrates with O365
>
> For initial implementation, we'll use local filesystem with a clear abstraction layer to swap later.

> [!IMPORTANT] > **Field Hours Approval Document**: The purpose/format of the uploaded document for field hours needs clarification. Currently implementing as a generic file upload.

---

## Database Schema

```mermaid
erDiagram
    User ||--o{ Timesheet : creates
    User ||--o{ Notification : receives
    Timesheet ||--|{ TimesheetEntry : contains
    Timesheet ||--o{ Attachment : has
    Timesheet ||--o{ Note : has

    User {
        uuid id PK
        string azure_id UK "Microsoft 365 ID"
        string email UK
        string display_name
        string phone "For Twilio SMS"
        boolean is_admin
        boolean sms_opt_in
        datetime created_at
        datetime updated_at
    }

    Timesheet {
        uuid id PK
        uuid user_id FK
        date week_start "Sunday of the week"
        string status "NEW|SUBMITTED|APPROVED|NEEDS_APPROVAL"
        boolean traveled
        boolean has_expenses
        boolean reimbursement_needed
        string reimbursement_type "Car|Flight|Food|Other"
        decimal reimbursement_amount
        date stipend_date
        datetime submitted_at
        datetime approved_at
        uuid approved_by FK
        datetime created_at
        datetime updated_at
    }

    TimesheetEntry {
        uuid id PK
        uuid timesheet_id FK
        date entry_date
        string hour_type "Field|Internal|Training|PTO|Unpaid|Holiday"
        decimal hours
        datetime created_at
    }

    Attachment {
        uuid id PK
        uuid timesheet_id FK
        string filename
        string original_filename
        string mime_type
        integer file_size
        datetime uploaded_at
    }

    Note {
        uuid id PK
        uuid timesheet_id FK
        uuid author_id FK
        text content
        datetime created_at
    }

    Notification {
        uuid id PK
        uuid user_id FK
        uuid timesheet_id FK
        string type "NEEDS_ATTACHMENT|APPROVED|REMINDER"
        string message
        boolean sent
        datetime sent_at
        datetime created_at
    }
```

---

## API Endpoints

### Authentication

| Method | Endpoint         | Description                 |
| ------ | ---------------- | --------------------------- |
| GET    | `/auth/login`    | Redirect to Microsoft login |
| GET    | `/auth/callback` | OAuth callback handler      |
| POST   | `/auth/logout`   | End session                 |
| GET    | `/api/me`        | Get current user info       |

### Timesheets (Regular User)

| Method | Endpoint                                 | Description                           |
| ------ | ---------------------------------------- | ------------------------------------- |
| GET    | `/api/timesheets`                        | List user's timesheets (with filters) |
| POST   | `/api/timesheets`                        | Create new draft timesheet            |
| GET    | `/api/timesheets/{id}`                   | Get timesheet with entries            |
| PUT    | `/api/timesheets/{id}`                   | Update draft timesheet                |
| DELETE | `/api/timesheets/{id}`                   | Delete draft timesheet                |
| POST   | `/api/timesheets/{id}/submit`            | Submit timesheet for approval         |
| POST   | `/api/timesheets/{id}/entries`           | Add/update time entries               |
| POST   | `/api/timesheets/{id}/attachments`       | Upload attachment                     |
| DELETE | `/api/timesheets/{id}/attachments/{aid}` | Remove attachment                     |
| POST   | `/api/timesheets/{id}/notes`             | Add note                              |

### Admin Endpoints

| Method | Endpoint                                       | Description                   |
| ------ | ---------------------------------------------- | ----------------------------- |
| GET    | `/api/admin/timesheets`                        | List all submitted timesheets |
| GET    | `/api/admin/timesheets/{id}`                   | Get timesheet details         |
| POST   | `/api/admin/timesheets/{id}/approve`           | Approve timesheet             |
| POST   | `/api/admin/timesheets/{id}/reject`            | Mark as needs approval        |
| POST   | `/api/admin/timesheets/{id}/unapprove`         | Revert approval               |
| GET    | `/api/admin/timesheets/{id}/attachments/{aid}` | Download attachment           |
| POST   | `/api/admin/timesheets/{id}/notes`             | Add admin note                |
| GET    | `/api/admin/users`                             | List all users                |

### Real-time Updates

| Method | Endpoint      | Description                      |
| ------ | ------------- | -------------------------------- |
| GET    | `/api/events` | SSE stream for real-time updates |

---

## File Structure

```
timesheet/
├── app/
│   ├── __init__.py              # App factory
│   ├── config.py                # Configuration classes
│   ├── extensions.py            # Flask extensions (db, migrate, etc.)
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py              # User model
│   │   ├── timesheet.py         # Timesheet + Entry models
│   │   ├── attachment.py        # Attachment model
│   │   ├── note.py              # Note model
│   │   └── notification.py      # Notification model
│   │
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py              # /auth/* endpoints
│   │   ├── timesheets.py        # /api/timesheets/* endpoints
│   │   ├── admin.py             # /api/admin/* endpoints
│   │   └── events.py            # /api/events SSE endpoint
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── timesheet_service.py # Business logic for timesheets
│   │   ├── auth_service.py      # MSAL authentication logic
│   │   ├── notification_service.py # Twilio + notification logic
│   │   └── storage_service.py   # File upload/download abstraction
│   │
│   └── utils/
│       ├── __init__.py
│       ├── decorators.py        # @login_required, @admin_required
│       └── validators.py        # Input validation helpers
│
├── static/
│   ├── css/
│   │   ├── main.css             # Global styles
│   │   ├── components.css       # Reusable components
│   │   └── admin.css            # Admin-specific styles
│   │
│   ├── js/
│   │   ├── app.js               # Main application
│   │   ├── api.js               # API client wrapper
│   │   ├── auth.js              # Authentication handling
│   │   ├── timesheet.js         # Timesheet form logic
│   │   ├── admin.js             # Admin dashboard logic
│   │   └── sse.js               # Server-sent events handler
│   │
│   └── img/
│       └── logo.svg             # Northstar logo
│
├── templates/
│   ├── base.html                # Base template
│   ├── index.html               # Main app (SPA-style)
│   ├── login.html               # Login page
│   └── error.html               # Error pages
│
├── tests/
│   ├── conftest.py              # Test fixtures
│   ├── test_models.py
│   ├── test_timesheets.py
│   └── test_admin.py
│
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
│
├── docs/
│   └── images/                  # Documentation images
│
├── migrations/                   # Alembic migrations
├── uploads/                      # Local file storage
│   └── .gitkeep
├── requirements.txt
├── requirements-dev.txt
├── .env.example
├── .gitignore
├── README.md
└── IMPLEMENTATION.md
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Flask
    participant MSAL
    participant AzureAD
    participant Database

    User->>Browser: Navigate to app
    Browser->>Flask: GET /
    Flask->>Browser: Redirect to /auth/login
    Browser->>Flask: GET /auth/login
    Flask->>MSAL: Build auth URL
    MSAL-->>Flask: Auth URL
    Flask->>Browser: Redirect to Azure AD
    Browser->>AzureAD: Login page
    User->>AzureAD: Enter credentials
    AzureAD->>Browser: Redirect to /auth/callback?code=xxx
    Browser->>Flask: GET /auth/callback?code=xxx
    Flask->>MSAL: Exchange code for token
    MSAL->>AzureAD: Token request
    AzureAD-->>MSAL: Access token + ID token
    MSAL-->>Flask: User claims
    Flask->>Database: Find or create user
    Database-->>Flask: User record
    Flask->>Browser: Set session, redirect to app
    Browser->>Flask: GET / (with session)
    Flask->>Browser: Render main app
```

---

## Timesheet Workflow

```mermaid
stateDiagram-v2
    [*] --> NEW: Create Draft
    NEW --> NEW: Edit/Save
    NEW --> [*]: Delete Draft
    NEW --> SUBMITTED: Submit

    SUBMITTED --> APPROVED: Admin Approves
    SUBMITTED --> NEEDS_APPROVAL: Missing Attachment

    NEEDS_APPROVAL --> SUBMITTED: User Uploads Attachment

    APPROVED --> SUBMITTED: Admin Un-approves

    note right of NEEDS_APPROVAL
        Triggers SMS notification
        to user
    end note

    note right of APPROVED
        Triggers SMS notification
        to user
    end note
```

---

## Hour Types & Business Logic

| Hour Type | Payable | Billable | Requires Attachment |
| --------- | ------- | -------- | ------------------- |
| Field     | ✅      | ✅       | ✅                  |
| Internal  | ✅      | ❌       | ❌                  |
| Training  | ❌      | ❌       | ❌                  |
| PTO       | ✅      | ❌       | ❌                  |
| Unpaid    | ❌      | ❌       | ❌                  |
| Holiday   | ✅      | ❌       | ❌                  |

---

## Development Phases

### Phase 1: Foundation ✅ (Complete)

- [x] Docker setup with Nginx + Gunicorn
- [x] Flask app factory with blueprints
- [x] PostgreSQL models with SQLAlchemy
- [x] MSAL authentication integration (with dev bypass)
- [x] Basic HTML templates and CSS

### Phase 2: Core Features (In Progress)

- [x] Timesheet CRUD API endpoints
- [x] Time entry management
- [x] Draft/Submit workflow
- [x] File upload for attachments
- [ ] JavaScript frontend for timesheet form (needs completion)

### Phase 3: Admin Features

- [x] Admin dashboard API
- [x] Approval workflow
- [ ] Filtering and reporting UI
- [x] Admin notes

### Phase 4: Notifications & Polish

- [ ] Twilio SMS integration
- [x] SSE real-time updates (basic)
- [ ] Weekly reminder job
- [ ] Auto-populate feature
- [ ] Tooltips and UX refinements

---

## Running the Application

### Docker (Recommended)

```bash
cd docker
docker compose up --build -d
```

Access at: http://localhost

### Development Mode

The app has a development bypass when Azure AD credentials are not configured. It creates a test user with admin access automatically.

---

## Open Questions

1. **File Storage**: Local vs. cloud - to be decided after initial prototype
2. **Field Hours Document**: What specific document is uploaded? Client sign-off sheet?
3. **Reporting**: Any export requirements (CSV, PDF reports)?
4. **Historical Data**: Need to migrate existing PowerApps data?
5. **Backup Strategy**: How frequently should database be backed up?
