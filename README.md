# Park-It 🅿️

A smart parking notification app that alerts you when to move your car for parking restrictions, trash pickup, street cleaning, and parking meter expiration—with walking distance predictions.

## Features

### Core Features (MVP)
- 🚗 **Parking Meter Countdown** - Real-time countdown timer with meter expiration alerts
- 🚶 **Walking Distance Prediction** - Calculates walking time back to your car and alerts you when to leave
- 🗑️ **Trash Pickup Notifications** - Crowdsourced trash day reminders
- 🧹 **Street Cleaning Alerts** - Know when street cleaning happens on your block
- 🚫 **Parking Sign Restrictions** - Crowdsourced parking time limit notifications
- ⏰ **Smart Alerts** - Multiple notification levels (time to leave, hurry up, expired)
- 📍 **Geofencing** - Warns if you walk too far from your car

### Future Features
- 📸 Photo uploads of parking signs for verification
- ⭐ User reputation/trust scores
- 🏙️ City API integration for trash/cleaning schedules
- 💳 In-app meter payment integration
- 🔔 Push notifications & SMS
- 🚗 Multiple vehicle tracking

## Tech Stack

### Backend
- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL with PostGIS (geospatial queries)
- **Task Scheduler:** APScheduler (for notifications & background jobs)
- **Auth:** JWT tokens
- **Distance Calculation:** Geopy (simple calculations, no API cost)

### Frontend
- **Framework:** React
- **Maps:** Google Maps API
- **State Management:** React Hooks
- **Location Tracking:** React Geolocated

## Project Structure

```
park-it/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app setup
│   │   ├── models.py               # Database models
│   │   ├── schemas.py              # Validation schemas
│   │   ├── database.py             # DB connection & setup
│   │   ├── config.py               # Configuration
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py             # Login/signup
│   │   │   ├── sessions.py         # Parking sessions
│   │   │   ├── maintenance.py      # Trash/cleaning
│   │   │   └── notifications.py    # Notification history
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── distance_service.py # Walking distance calc
│   │   │   ├── notification_service.py
│   │   │   ├── auth_service.py
│   │   │   └── location_service.py
│   │   └── jobs/
│   │       ├── __init__.py
│   │       ├── meter_alerts.py    # Check meter expiration
│   │       └── maintenance_reminders.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   └── README.md
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map.js
│   │   │   ├── MeterCountdown.js
│   │   │   ├── WalkingDistance.js
│   │   │   ├── MaintenanceModal.js
│   │   │   └── Navigation.js
│   │   ├── pages/
│   │   │   ├── LoginPage.js
│   │   │   ├── MapPage.js
│   │   │   ├── ActiveParkingPage.js
│   │   │   └── SessionHistory.js
│   │   ├── hooks/
│   │   │   ├── useCountdownTimer.js
│   │   │   ├── useLocationTracking.js
│   │   │   └── useAuth.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── geolocation.js
│   │   │   └── storage.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   ├── .env.example
│   ├── Dockerfile
│   └── README.md
├── docker-compose.yml
├── .gitignore
└── README.md (this file)
```

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 16+
- PostgreSQL 12+
- Docker (optional)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy .env file
cp .env.example .env
# Edit .env with your settings

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload
```

Server runs at: `http://localhost:8000`
API docs: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your API URL and Google Maps key

npm start
```

App runs at: `http://localhost:3000`

### Docker Setup

```bash
docker-compose up
```

## API Documentation

See [BACKEND_README.md](./backend/README.md) for detailed API endpoints.

## Database Schema

See [DATABASE.md](./docs/DATABASE.md) for schema details.

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost/park_it
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_GOOGLE_MAPS_KEY=your-google-maps-key
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Contact

Questions? Open an issue on GitHub!

---

**Status:** 🚀 In Development (MVP Phase)
