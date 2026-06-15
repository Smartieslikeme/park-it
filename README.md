# Park-It 🅿️

[![Python](https://img.shields.io/badge/Python-3.9+-3776ab?logo=python&logoColor=white)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-MVP%20Phase-orange)](#status)

---

## 🎯 Problem Statement

Ever gotten a parking ticket because you forgot when your meter expires? Or missed a street cleaning deadline? Park-It eliminates these frustrations by **proactively alerting you to move your car before it's too late**—with walking distance calculations to tell you when to actually leave your current location.

## Overview

Park-It is a **smart parking notification app** that combines real-time meter tracking, crowdsourced parking data, and intelligent geofencing to keep you informed about all parking-related deadlines in your area. Get alerts for meter expiration, parking sign restrictions, trash pickup days, and street cleaning—plus walking time predictions so you know when to leave.

---

## ✨ Features

### Core Features (MVP - Implemented/In Progress)
- 🚗 **Parking Meter Countdown** - Real-time countdown timer with meter expiration alerts
- 🚶 **Walking Distance Prediction** - Calculates walking time back to your car and alerts you when to leave
- 🗑️ **Trash Pickup Notifications** - Crowdsourced trash day reminders
- 🧹 **Street Cleaning Alerts** - Know when street cleaning happens on your block
- 🚫 **Parking Sign Restrictions** - Crowdsourced parking time limit notifications
- ⏰ **Smart Alerts** - Multiple notification levels (time to leave, hurry up, expired)
- 📍 **Geofencing** - Warns if you walk too far from your car
- 🔐 **User Authentication** - Secure JWT-based login and signup

### Future Features (Planned)
- 📸 **Photo uploads of parking signs** for verification (Q3 2026)
- ⭐ **User reputation/trust scores** for crowdsourced data validation (Q3 2026)
- 🏙️ **City API integration** for authoritative trash/cleaning schedules (Q4 2026)
- 💳 **In-app meter payment integration** (Q4 2026)
- 🔔 **Push notifications & SMS** (Q2 2026)
- 🚗 **Multiple vehicle tracking** (Q3 2026)
- 📊 **Parking history analytics** - Track spending, patterns, and trends (Future)
- 🗺️ **Offline map support** - View parking info without internet (Future)

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** (Python 3.9+) | Modern async web framework |
| **PostgreSQL 12+** | Relational database with PostGIS extension for geospatial queries |
| **PostGIS** | Advanced location-based queries and distance calculations |
| **APScheduler** | Background job scheduling for meter alerts and notifications |
| **SQLAlchemy** | ORM for database modeling |
| **Pydantic** | Data validation and serialization |
| **JWT (PyJWT)** | Stateless authentication |
| **Geopy** | Walking distance calculations (no external API cost) |

### Frontend
| Technology | Purpose |
|---|---|
| **React 18+** | UI framework |
| **Google Maps API** | Interactive mapping and location services |
| **React Hooks** | State management and lifecycle |
| **React Geolocated** | Real-time geolocation tracking |
| **Axios** | HTTP client |
| **CSS-in-JS** | Component styling |

### DevOps
| Technology | Purpose |
|---|---|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **Alembic** | Database migrations |

---

## 📁 Project Structure

```
park-it/
├── backend/                          # FastAPI backend service
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI app initialization & middleware setup
│   │   ├── models.py                 # SQLAlchemy ORM database models
│   │   ├── schemas.py                # Pydantic validation schemas & serializers
│   │   ├── database.py               # DB connection, session management & PostGIS setup
│   │   ├── config.py                 # Environment & app configuration
│   │   ├── routes/                   # API endpoint handlers
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               # POST /auth/login, POST /auth/signup
│   │   │   ├── sessions.py           # CRUD operations for parking sessions
│   │   │   ├── maintenance.py        # GET/POST trash & street cleaning data
│   │   │   └── notifications.py      # GET notification history
│   │   ├── services/                 # Business logic layer
│   │   │   ├── __init__.py
│   │   │   ├── distance_service.py   # Walking distance & ETA calculations
│   │   │   ├── notification_service.py # Alert generation & delivery
│   │   │   ├── auth_service.py       # JWT token management & password hashing
│   │   │   ├── location_service.py   # Geofencing & location validation
│   │   │   └── crowdsource_service.py # Data validation for crowdsourced info
│   │   ├── jobs/                     # APScheduler background jobs
│   │   │   ├── __init__.py
│   │   │   ├── meter_alerts.py       # Periodic meter expiration checks
│   │   │   └── maintenance_reminders.py # Trash & cleaning schedule checks
│   │   └── utils/
│   │       └── logger.py             # Logging configuration
│   ├── migrations/                   # Alembic database migrations
│   ├── tests/                        # Unit & integration tests
│   ├── requirements.txt              # Python dependencies
│   ├── .env.example                  # Environment template
│   ├── Dockerfile                    # Container image
│   ├── README.md                     # Backend documentation
│   └── pytest.ini                    # Test configuration
│
├── frontend/                         # React web application
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/               # Reusable React components
│   │   │   ├── Map.js                # Google Maps integration
│   │   │   ├── MeterCountdown.js     # Countdown timer display
│   │   │   ├── WalkingDistance.js    # ETA & walking status
│   │   │   ├── MaintenanceModal.js   # Trash/cleaning info modal
│   │   │   ├── AlertBanner.js        # Notification alerts UI
│   │   │   ├── Navigation.js         # App navigation header
│   │   │   └── GeofenceWarning.js    # Out-of-range warning
│   │   ├── pages/                    # Full-page components
│   │   │   ├── LoginPage.js          # Authentication
│   │   │   ├── MapPage.js            # Main app view with map
│   │   │   ├── ActiveParkingPage.js  # Current session details
│   │   │   └── SessionHistory.js     # Past parking sessions
│   │   ├── hooks/                    # Custom React hooks
│   │   │   ├── useCountdownTimer.js  # Countdown logic
│   │   │   ├── useLocationTracking.js # Geolocation & tracking
│   │   │   ├── useAuth.js            # Authentication state
│   │   │   └── useNotifications.js   # Notification handling
│   │   ├── services/                 # API & utility services
│   │   │   ├── api.js                # Axios instance & API calls
│   │   │   ├── geolocation.js        # Location utilities
│   │   │   ├── storage.js            # LocalStorage helpers
│   │   │   └── notifications.js      # Web notifications
│   │   ├── App.js                    # Root component & routing
│   │   ├── index.js                  # React entry point
│   │   └── index.css                 # Global styles
│   ├── package.json                  # npm dependencies & scripts
│   ├── .env.example                  # Environment template
│   ├── Dockerfile                    # Container image
│   ├── .eslintrc.json                # Linting rules
│   └── README.md                     # Frontend documentation
│
├── docs/                             # Project documentation
│   ├── DATABASE.md                   # Schema, migrations, PostGIS usage
│   ├── ARCHITECTURE.md               # System design & data flow
│   ├── API.md                        # Detailed endpoint documentation
│   ├── CROWDSOURCING.md              # Data validation strategy
│   └── DEPLOYMENT.md                 # Production deployment guide
│
├── .github/
│   └── workflows/                    # CI/CD pipelines
│       ├── test.yml                  # Backend/frontend tests on push
│       ├── build.yml                 # Docker image building
│       └── deploy.yml                # Deployment automation
│
├── docker-compose.yml                # Local dev environment
├── docker-compose.prod.yml           # Production compose (optional)
├── .gitignore                        # Git ignore rules
├── .env.example                      # Root environment template
├── LICENSE                           # MIT License
└── README.md                         # This file

```

---

## 🚀 Quick Start

### Prerequisites

- **Python** 3.9 or higher
- **Node.js** 16 or higher (npm 7+)
- **PostgreSQL** 12 or higher
- **Docker & Docker Compose** (optional, for containerized setup)

### ⚡ Fastest Setup (Docker)

```bash
# Clone the repository
git clone https://github.com/Smartieslikeme/park-it.git
cd park-it

# Copy environment template
cp .env.example .env

# Edit .env with your settings (especially GOOGLE_MAPS_API_KEY)
nano .env

# Start all services
docker-compose up --build

# Seed database (in another terminal)
docker-compose exec backend python -m app.seed_db
```

Then visit:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

---

### 🛠 Manual Setup

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials and settings
nano .env

# Initialize database
alembic upgrade head

# (Optional) Seed sample data
python -m app.seed_db

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Server outputs:**
- 🌐 API: `http://localhost:8000`
- 📚 Interactive API docs: `http://localhost:8000/docs`
- 🔍 Alternative docs: `http://localhost:8000/redoc`

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your API URL and Google Maps API key
nano .env

# Start development server with hot reload
npm start
```

**App output:**
- 🎨 Frontend: `http://localhost:3000` (auto-opens in browser)

---

## 📖 Documentation

| Document | Purpose |
|---|---|
| **[API.md](./docs/API.md)** | Complete API endpoint reference with examples |
| **[DATABASE.md](./docs/DATABASE.md)** | Database schema, migrations, PostGIS queries |
| **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | System design, data flow, component interactions |
| **[CROWDSOURCING.md](./docs/CROWDSOURCING.md)** | Validation strategy, trust scoring, abuse prevention |
| **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** | Production setup, scaling, monitoring |
| **[backend/README.md](./backend/README.md)** | Backend-specific development notes |
| **[frontend/README.md](./frontend/README.md)** | Frontend-specific development notes |

---

## ⚙️ Environment Variables

### Backend Configuration (.env)

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/park_it
SQLALCHEMY_ECHO=false  # Log SQL queries (set to true for debugging)

# Authentication
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# JWT Configuration
JWT_ALGORITHM=HS256

# Google Maps (optional for initial setup)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Notifications
NOTIFICATION_CHECK_INTERVAL_MINUTES=5
METER_WARNING_MINUTES=15  # Alert when this many minutes remain

# Geofencing
GEOFENCE_RADIUS_METERS=500

# Logging
LOG_LEVEL=INFO
```

### Frontend Configuration (.env)

```env
# API Backend
REACT_APP_API_URL=http://localhost:8000
REACT_APP_API_TIMEOUT_MS=10000

# Google Maps
REACT_APP_GOOGLE_MAPS_KEY=your-google-maps-api-key

# Feature Flags
REACT_APP_ENABLE_PUSH_NOTIFICATIONS=false
REACT_APP_ENABLE_SMS_ALERTS=false

# Environment
REACT_APP_ENV=development
```

---

## 🧪 Testing

### Backend Testing

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py -v

# Run tests matching pattern
pytest -k "test_meter" -v

# Run with detailed output
pytest -vv -s
```

**Test structure:**
```
backend/tests/
├── test_auth.py           # Authentication endpoints
├── test_sessions.py       # Parking session CRUD
├── test_notifications.py  # Notification logic
├── test_distance.py       # Walking distance calculations
├── conftest.py            # Pytest fixtures & configuration
└── fixtures/              # Test data
```

### Frontend Testing

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- UseAuth.test.js
```

---

## 🔧 Development Workflow

### Running Locally with Hot Reload

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

Changes to either codebase will auto-reload in the browser and API server.

### Database Development

**Create a new migration:**
```bash
cd backend
alembic revision --autogenerate -m "Add new feature column"
alembic upgrade head
```

**Inspect PostGIS functions:**
```bash
psql park_it
# Check geospatial functions available
SELECT * FROM pg_proc WHERE proname ~ 'geo';
```

### Debugging

**Backend:**
- API docs available at `http://localhost:8000/docs`
- Enable SQL logging: Set `SQLALCHEMY_ECHO=true` in `.env`
- Use `breakpoint()` in code for interactive debugging

**Frontend:**
- Chrome DevTools (F12) with React Developer Tools extension
- Redux DevTools (if state management is added)
- Network tab to inspect API calls

---

## 🌐 API Overview

### Key Endpoints

**Authentication**
- `POST /api/v1/auth/signup` - Register new user
- `POST /api/v1/auth/login` - User login (returns JWT)
- `POST /api/v1/auth/refresh` - Refresh access token

**Parking Sessions**
- `POST /api/v1/sessions` - Start a new parking session
- `GET /api/v1/sessions` - List user's sessions
- `GET /api/v1/sessions/{id}` - Get session details
- `PUT /api/v1/sessions/{id}` - Update session (e.g., mark as ended)
- `DELETE /api/v1/sessions/{id}` - Delete session

**Maintenance (Trash & Cleaning)**
- `GET /api/v1/maintenance/trash-pickup` - Get trash schedule for area
- `POST /api/v1/maintenance/trash-pickup` - Submit trash pickup info
- `GET /api/v1/maintenance/street-cleaning` - Get street cleaning schedule
- `POST /api/v1/maintenance/street-cleaning` - Submit cleaning info

**Notifications**
- `GET /api/v1/notifications` - Get user's notification history
- `PUT /api/v1/notifications/{id}/read` - Mark notification as read

**Crowdsourced Data**
- `GET /api/v1/signs` - Fetch nearby parking sign restrictions
- `POST /api/v1/signs` - Submit photo/info of parking sign

**Location**
- `POST /api/v1/location/check-distance` - Check walking distance to car
- `POST /api/v1/location/validate-geofence` - Validate if user is in geofence

See [API.md](./docs/API.md) for full documentation with request/response examples.

---

## 💾 Database Schema Highlights

The database uses **PostgreSQL with PostGIS** for geospatial queries:

**Key Tables:**
- `users` - Registered users with credentials
- `parking_sessions` - Active and historical parking records
- `locations` - User location snapshots for distance tracking
- `signs` - Crowdsourced parking sign restrictions with geolocation
- `trash_schedules` - Crowdsourced trash pickup info by day/area
- `street_cleaning_schedules` - Crowdsourced street cleaning data
- `notifications` - Generated alerts sent to users
- `user_reputation` - Trust scores for crowdsourced data validators

**PostGIS Spatial Queries:**
```sql
-- Find all parking signs within 1km of user location
SELECT * FROM signs
WHERE ST_DWithin(location::geography, 
  ST_GeomFromText('POINT(-74.006 40.7128)', 4326)::geography, 1000);

-- Calculate walking distance between two points
SELECT ST_Distance(
  ST_GeomFromText('POINT(-74.006 40.7128)', 4326)::geography,
  ST_GeomFromText('POINT(-74.008 40.714)', 4326)::geography
) / 1000 as distance_km;
```

See [DATABASE.md](./docs/DATABASE.md) for complete schema documentation.

---

## 🤝 Contributing

We welcome contributions! Follow these steps:

### 1. Fork & Clone
```bash
git clone https://github.com/YOUR-USERNAME/park-it.git
cd park-it
```

### 2. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
# or for bug fixes:
git checkout -b fix/bug-description
```

### 3. Make Changes
- Create a feature branch per GitHub guidelines
- Write tests for new functionality
- Update relevant documentation
- Keep commits atomic and well-described

### 4. Run Tests & Linting
```bash
# Backend
cd backend
pytest
flake8 app/
black app/

# Frontend
cd frontend
npm test
npm run lint
```

### 5. Commit & Push
```bash
git add .
git commit -m "feat: brief description of changes"
git push origin feature/your-feature-name
```

### 6. Open Pull Request
- Link related issues
- Describe what your PR changes and why
- Include any relevant testing notes

**Guidelines:**
- One feature/fix per pull request
- Write descriptive commit messages
- Update `CHANGELOG.md` if applicable
- Add tests for all new code
- Follow existing code style

---

## 🔐 Security Considerations

- **Passwords:** Hashed with bcrypt, never stored in plaintext
- **JWT Tokens:** Short-lived access tokens (30 min default) + refresh tokens
- **Geolocation:** Stored only for active sessions; deleted after session ends
- **API Rate Limiting:** Implemented on auth endpoints (prevent brute force)
- **Input Validation:** All user input validated with Pydantic schemas
- **CORS:** Configured to allow frontend domain only
- **HTTPS:** Required in production (use SSL certificate)

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for security hardening checklist.

---

## 🚀 Deployment

### Docker Compose (Production-ready)

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Cloud Platforms

- **Heroku:** Use `Procfile` for easy deployment
- **AWS:** ECS, RDS (PostgreSQL), CloudWatch for monitoring
- **Google Cloud:** Cloud Run, Cloud SQL, Pub/Sub for notifications
- **DigitalOcean:** App Platform with PostgreSQL managed database

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed setup per platform.

---

## 📊 Roadmap

### Q2 2026
- ✅ MVP core features (meter countdown, geofencing)
- 🔄 Push notifications for iOS/Android
- 🔄 Parking sign photo uploads with ML verification

### Q3 2026
- User reputation/trust scoring system
- Multiple vehicle tracking
- Analytics dashboard

### Q4 2026
- City API integration (official trash schedules)
- In-app meter payment integration
- SMS alerts

### 2027+
- Mobile apps (React Native)
- AI-powered parking spot recommendations
- Street-level parking sign recognition via camera

---

## 🐛 Known Issues & Limitations

| Issue | Status | Workaround |
|---|---|---|
| Offline map support | Planned Q3 2026 | Use browser caching for now |
| SMS/push notifications | In progress | Email notifications available |
| Multi-car tracking | Planned Q3 2026 | Single vehicle per user currently |
| City API integration | Planned Q4 2026 | Use crowdsourced data for now |

See [GitHub Issues](https://github.com/Smartieslikeme/park-it/issues) for latest updates.

---

## 📞 Support & Contact

- **Issues & Bug Reports:** [GitHub Issues](https://github.com/Smartieslikeme/park-it/issues)
- **Discussions & Feature Requests:** [GitHub Discussions](https://github.com/Smartieslikeme/park-it/discussions)
- **Email:** smartieslikeme@icloud.com

---

## 📄 License

Park-It is licensed under the **MIT License** — see [LICENSE](./LICENSE) file for details.



---

## 🙏 Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Modern web framework
- [PostGIS](https://postgis.net/) - Geospatial database extension
- [React](https://react.dev/) - UI library
- [Google Maps API](https://developers.google.com/maps) - Mapping services
- Contributors and the open-source community

---

## 📈 Metrics & Status

| Metric | Status |
|---|---|
| **Current Phase** | MVP Development |
| **Test Coverage** | TBD (target: 80%+) |
| **Build Status** | ![Build](https://img.shields.io/badge/build-passing-brightyellow) |
| **Last Updated** | June 2026 |
| **Contributors** | 1 (meeee!) |

---

<div align="center">

**🅿️ Never get a parking ticket again. Park It, track it, own it.**

[⬆ back to top](#park-it-)

</div>
