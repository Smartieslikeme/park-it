"""Parking Sessions Routes"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models import User, ParkingSession
from app.schemas import (
    StartMeterParkingRequest,
    StartMeterParkingWithTimeRequest,
    StartUnrestrictedParkingRequest,
    ParkingSessionResponse,
    ExtendMeterRequest,
    UpdateLocationRequest
)
from app.services.auth_service import decode_token
from app.services.distance_service import get_distance_and_walking_time

router = APIRouter(prefix="/sessions", tags=["sessions"])


def get_current_user(authorization: str = None, db: Session = Depends(get_db)) -> User:
    """Get current authenticated user from token"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise ValueError("Invalid scheme")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.email == payload["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


def build_session_response(session: ParkingSession, current_lat: Optional[float] = None, current_lon: Optional[float] = None) -> dict:
    """Build response with calculated fields"""
    response = {
        "id": session.id,
        "user_id": session.user_id,
        "car_latitude": session.car_latitude,
        "car_longitude": session.car_longitude,
        "parking_type": session.parking_type,
        "amount_paid": session.amount_paid,
        "hourly_rate": session.hourly_rate,
        "meter_expires_at": session.meter_expires_at,
        "walking_time_minutes": session.walking_time_minutes,
        "should_leave_by": session.should_leave_by,
        "maintenance_reason": session.maintenance_reason,
        "move_by_datetime": session.move_by_datetime,
        "parked_at": session.parked_at,
        "ended_at": session.ended_at,
        "is_active": session.is_active,
        "last_known_latitude": session.last_known_latitude,
        "last_known_longitude": session.last_known_longitude,
        "distance_to_car_meters": None,
        "time_remaining_minutes": None,
        "time_until_should_leave_minutes": None
    }
    
    # Calculate real-time distance if current location provided
    if current_lat is not None and current_lon is not None:
        distance, walking_time = get_distance_and_walking_time(
            current_lat, current_lon,
            session.car_latitude, session.car_longitude
        )
        response["distance_to_car_meters"] = distance
        response["last_known_latitude"] = current_lat
        response["last_known_longitude"] = current_lon
        
        # Calculate time remaining until should leave
        if session.should_leave_by:
            time_until_leave = (session.should_leave_by - datetime.utcnow()).total_seconds() / 60
            response["time_until_should_leave_minutes"] = max(0, time_until_leave)
    
    # Calculate time remaining on meter
    if session.meter_expires_at:
        time_remaining = (session.meter_expires_at - datetime.utcnow()).total_seconds() / 60
        response["time_remaining_minutes"] = max(0, time_remaining)
    
    return response


@router.post("/start-meter", response_model=dict, status_code=status.HTTP_201_CREATED)
def start_meter_parking(
    parking: StartMeterParkingRequest,
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Start parking at a meter.
    
    Calculates:
    - Walking time back to car
    - When to leave (meter_expires_at - walking_time)
    - Meter expiration time
    
    Returns session with all calculated times.
    """
    user = get_current_user(authorization, db)
    
    # Calculate meter expiration
    duration_hours = parking.amount_paid / parking.hourly_rate
    meter_expires_at = datetime.utcnow() + timedelta(hours=duration_hours)
    
    # For initial request, we don't have user location yet
    # Walking time will be 0 until user updates location
    walking_time_minutes = 0
    should_leave_by = meter_expires_at
    
    # Create parking session
    session = ParkingSession(
        user_id=user.id,
        car_latitude=parking.car_latitude,
        car_longitude=parking.car_longitude,
        parking_type="meter",
        amount_paid=parking.amount_paid,
        hourly_rate=parking.hourly_rate,
        meter_expires_at=meter_expires_at,
        walking_time_minutes=walking_time_minutes,
        should_leave_by=should_leave_by,
        is_active=True
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return build_session_response(session)


@router.post("/start-meter-with-time", response_model=dict, status_code=status.HTTP_201_CREATED)
def start_meter_parking_with_time(
    parking: StartMeterParkingWithTimeRequest,
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Start parking at a meter with explicit expiration time.
    
    Useful when user knows exact expiration time (e.g., 3:45pm).
    """
    user = get_current_user(authorization, db)
    
    # Validate expiration time is in future
    if parking.expires_at <= datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expiration time must be in the future"
        )
    
    # Create parking session
    session = ParkingSession(
        user_id=user.id,
        car_latitude=parking.car_latitude,
        car_longitude=parking.car_longitude,
        parking_type="meter",
        meter_expires_at=parking.expires_at,
        walking_time_minutes=0,
        should_leave_by=parking.expires_at,
        is_active=True
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return build_session_response(session)


@router.post("/start-unrestricted", response_model=dict, status_code=status.HTTP_201_CREATED)
def start_unrestricted_parking(
    parking: StartUnrestrictedParkingRequest,
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Start parking at an unrestricted spot.
    
    For trash pickup or street cleaning reminders.
    """
    user = get_current_user(authorization, db)
    
    # Validate move_by_datetime is in future
    if parking.move_by_datetime <= datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Move by time must be in the future"
        )
    
    # Create parking session
    session = ParkingSession(
        user_id=user.id,
        car_latitude=parking.car_latitude,
        car_longitude=parking.car_longitude,
        parking_type="unrestricted",
        maintenance_reason=parking.maintenance_reason,
        move_by_datetime=parking.move_by_datetime,
        is_active=True
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return build_session_response(session)


@router.get("/active", response_model=Optional[dict])
def get_active_session(
    authorization: str = Query(None, description="Bearer token"),
    current_latitude: Optional[float] = Query(None, description="User's current latitude"),
    current_longitude: Optional[float] = Query(None, description="User's current longitude"),
    db: Session = Depends(get_db)
):
    """
    Get user's active parking session.
    
    Returns None if no active session.
    
    If current location provided, calculates:
    - Distance to car
    - Walking time to car
    - Time until should leave
    """
    user = get_current_user(authorization, db)
    
    session = db.query(ParkingSession).filter(
        ParkingSession.user_id == user.id,
        ParkingSession.is_active == True
    ).first()
    
    if not session:
        return None
    
    return build_session_response(session, current_latitude, current_longitude)


@router.post("/{session_id}/update-location", response_model=dict)
def update_session_location(
    session_id: int,
    location: UpdateLocationRequest,
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Update user's current location for active parking session.
    
    Recalculates:
    - Distance to car
    - Walking time to car
    - Whether geofence alert should be sent
    - Whether "leave now" alert should be sent
    
    Returns updated session with calculated times.
    """
    user = get_current_user(authorization, db)
    
    session = db.query(ParkingSession).filter(
        ParkingSession.id == session_id,
        ParkingSession.user_id == user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking session not found"
        )
    
    if not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parking session is not active"
        )
    
    # Update location
    session.last_known_latitude = location.current_latitude
    session.last_known_longitude = location.current_longitude
    
    # Calculate distance and walking time
    distance, walking_time = get_distance_and_walking_time(
        location.current_latitude, location.current_longitude,
        session.car_latitude, session.car_longitude
    )
    
    # For meter parking, recalculate should_leave_by
    if session.parking_type == "meter" and session.meter_expires_at:
        new_should_leave_by = session.meter_expires_at - timedelta(minutes=walking_time)
        session.should_leave_by = new_should_leave_by
        session.walking_time_minutes = walking_time
    
    # Check geofence warning
    # Alert if user is walking away from car (distance increasing)
    if distance > session.max_distance_from_car_meters and not session.geofence_warning_sent:
        session.geofence_warning_sent = True
        # TODO: Send geofence warning notification
    
    db.commit()
    db.refresh(session)
    
    return build_session_response(session, location.current_latitude, location.current_longitude)


@router.post("/{session_id}/extend", response_model=dict)
def extend_meter_parking(
    session_id: int,
    extension: ExtendMeterRequest,
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Extend meter parking by adding more time/money.
    
    Recalculates:
    - New meter expiration time
    - New "should leave by" time
    """
    user = get_current_user(authorization, db)
    
    session = db.query(ParkingSession).filter(
        ParkingSession.id == session_id,
        ParkingSession.user_id == user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking session not found"
        )
    
    if session.parking_type != "meter":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only extend meter parking sessions"
        )
    
    if not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parking session is not active"
        )
    
    # Calculate additional time
    if session.hourly_rate and session.hourly_rate > 0:
        additional_hours = extension.additional_amount / session.hourly_rate
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot extend: hourly rate is invalid"
        )
    
    # Extend meter expiration
    session.meter_expires_at += timedelta(hours=additional_hours)
    session.amount_paid += extension.additional_amount
    
    # Reset notification flags when extended
    session.meter_expired_notification_sent = False
    session.leave_notification_sent = False
    
    # Recalculate should_leave_by if we have walking time
    if session.walking_time_minutes:
        session.should_leave_by = session.meter_expires_at - timedelta(minutes=session.walking_time_minutes)
    else:
        session.should_leave_by = session.meter_expires_at
    
    db.commit()
    db.refresh(session)
    
    return build_session_response(session)


@router.post("/{session_id}/end", status_code=status.HTTP_204_NO_CONTENT)
def end_parking_session(
    session_id: int,
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Mark parking session as ended (user moved car).
    
    Deactivates the session and records end time.
    """
    user = get_current_user(authorization, db)
    
    session = db.query(ParkingSession).filter(
        ParkingSession.id == session_id,
        ParkingSession.user_id == user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking session not found"
        )
    
    if not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parking session is already ended"
        )
    
    session.is_active = False
    session.ended_at = datetime.utcnow()
    
    db.commit()


@router.get("/history", response_model=list)
def get_parking_history(
    limit: int = Query(10, ge=1, le=100),
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Get user's parking history (ended sessions).
    
    Useful for showing past parking locations and durations.
    """
    user = get_current_user(authorization, db)
    
    sessions = db.query(ParkingSession).filter(
        ParkingSession.user_id == user.id,
        ParkingSession.is_active == False
    ).order_by(ParkingSession.ended_at.desc()).limit(limit).all()
    
    return [build_session_response(session) for session in sessions]


@router.get("/{session_id}", response_model=dict)
def get_session_details(
    session_id: int,
    current_latitude: Optional[float] = Query(None),
    current_longitude: Optional[float] = Query(None),
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific parking session.
    """
    user = get_current_user(authorization, db)
    
    session = db.query(ParkingSession).filter(
        ParkingSession.id == session_id,
        ParkingSession.user_id == user.id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking session not found"
        )
    
    return build_session_response(session, current_latitude, current_longitude)
