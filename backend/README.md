# Park-It Backend

FastAPI backend for the Park-It parking notification application.

## Setup

### Prerequisites
- Python 3.9+
- PostgreSQL 12+

### Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
```

### Environment Configuration

Edit `.env` with your local settings:
```
DATABASE_URL=postgresql://user:password@localhost:5432/park_it
SECRET_KEY=your-dev-secret-key
ENVIRONMENT=development
DEBUG=True
```

### Running the Server

```bash
uvicorn app.main:app --reload
```

Server runs at: `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

## API Endpoints

### Authentication
- `POST /auth/signup` - Create new account
- `POST /auth/login` - Login user

### Parking Sessions (Coming Soon)
- `POST /sessions/start-meter` - Start meter parking
- `GET /sessions/active` - Get active parking session
- `POST /sessions/{id}/update-location` - Update user location
- `POST /sessions/{id}/extend` - Extend meter time
- `POST /sessions/{id}/end` - End parking session

### Parking Signs (Coming Soon)
- `GET /signs/nearby` - Get nearby parking signs
- `POST /signs` - Add parking sign
- `POST /signs/{id}/confirm` - Confirm sign info

### Street Maintenance (Coming Soon)
- `GET /maintenance/nearby` - Get nearby trash/cleaning
- `POST /maintenance/trash` - Report trash pickup
- `POST /maintenance/cleaning` - Report street cleaning

## Project Structure

```
app/
├── main.py           # FastAPI app
├── config.py         # Configuration
├── database.py       # Database setup
├── models.py         # SQLAlchemy models
├── schemas.py        # Pydantic schemas
├── routes/           # API routes
│   ├── auth.py
│   ├── sessions.py
│   ├── signs.py
│   ├── maintenance.py
│   └── notifications.py
├── services/         # Business logic
│   ├── auth_service.py
│   ├── distance_service.py
│   ├── notification_service.py
│   └── location_service.py
└── jobs/             # Background jobs
    ├── meter_alerts.py
    └── maintenance_reminders.py
```

## Database

Using SQLAlchemy ORM with PostgreSQL. Tables:
- `users` - User accounts
- `parking_sessions` - Active and historical parking
- `parking_signs` - Crowdsourced parking restrictions
- `sign_confirmations` - User confirmations of sign accuracy
- `street_maintenance` - Trash/cleaning schedules
- `notifications` - Notification history

## Next Steps

- [ ] Complete parking sessions routes
- [ ] Complete parking signs routes
- [ ] Complete street maintenance routes
- [ ] Add background job scheduler
- [ ] Add notification service
- [ ] Add database migrations with Alembic
