"""FastAPI Application Entry Point"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routes import auth, signs, sessions, vehicles, photos
from app.config import get_settings

# Create tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Park-It API",
    description="Smart parking notification system - Privacy-First",
    version="0.1.0"
)

settings = get_settings()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(signs.router)
app.include_router(sessions.router)
app.include_router(vehicles.router)
app.include_router(photos.router)


@app.get("/")
def read_root():
    """Root endpoint"""
    return {
        "message": "Welcome to Park-It API",
        "environment": settings.environment,
        "docs": "/docs",
        "privacy": "Photos are deleted after text extraction. Only parking rules are saved."
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
