"""Parking Signs Routes"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from datetime import datetime

from app.database import get_db
from app.models import User, ParkingSign, SignConfirmation
from app.schemas import ParkingSignCreate, ParkingSignResponse
from app.services.auth_service import decode_token
from app.services.distance_service import calculate_distance

router = APIRouter(prefix="/signs", tags=["signs"])


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


@router.post("", response_model=ParkingSignResponse, status_code=status.HTTP_201_CREATED)
def create_parking_sign(
    sign: ParkingSignCreate,
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Create a new parking sign entry.
    
    Requires authentication. User's location and sign details are stored.
    """
    user = get_current_user(authorization, db)
    
    # Create new parking sign
    new_sign = ParkingSign(
        latitude=sign.latitude,
        longitude=sign.longitude,
        sign_type=sign.sign_type,
        time_limit=sign.time_limit,
        allowed_hours=sign.allowed_hours,
        restrictions=sign.restrictions,
        created_by=user.id,
        confirmation_count=1  # Creator's confirmation counts as 1
    )
    
    db.add(new_sign)
    db.commit()
    db.refresh(new_sign)
    
    # Also create initial confirmation
    confirmation = SignConfirmation(
        parking_sign_id=new_sign.id,
        user_id=user.id
    )
    db.add(confirmation)
    db.commit()
    
    return new_sign


@router.get("/nearby", response_model=List[ParkingSignResponse])
def get_nearby_signs(
    latitude: float = Query(..., description="User's current latitude"),
    longitude: float = Query(..., description="User's current longitude"),
    radius_meters: int = Query(500, description="Search radius in meters"),
    db: Session = Depends(get_db)
):
    """
    Get all parking signs within a specified radius of user's location.
    
    Returns all active signs sorted by distance (closest first).
    No authentication required.
    """
    # Get all active signs
    all_signs = db.query(ParkingSign).filter(ParkingSign.is_active == True).all()
    
    # Filter by distance
    nearby_signs = []
    for sign in all_signs:
        distance = calculate_distance(
            latitude, longitude,
            sign.latitude, sign.longitude
        )
        
        if distance <= radius_meters:
            nearby_signs.append({
                "sign": sign,
                "distance": distance
            })
    
    # Sort by distance (closest first)
    nearby_signs.sort(key=lambda x: x["distance"])
    
    return [item["sign"] for item in nearby_signs]


@router.get("/{sign_id}", response_model=ParkingSignResponse)
def get_parking_sign(
    sign_id: int = Query(..., description="Parking sign ID"),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific parking sign.
    
    No authentication required.
    """
    sign = db.query(ParkingSign).filter(ParkingSign.id == sign_id).first()
    
    if not sign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking sign not found"
        )
    
    return sign


@router.post("/{sign_id}/confirm", response_model=ParkingSignResponse)
def confirm_parking_sign(
    sign_id: int,
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Confirm that a parking sign's information is still accurate.
    
    - Increases confirmation count
    - Updates last_confirmed_at timestamp
    - Records user's confirmation
    - Requires authentication
    """
    user = get_current_user(authorization, db)
    
    sign = db.query(ParkingSign).filter(ParkingSign.id == sign_id).first()
    if not sign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking sign not found"
        )
    
    # Check if user already confirmed this sign
    existing_confirmation = db.query(SignConfirmation).filter(
        and_(
            SignConfirmation.parking_sign_id == sign_id,
            SignConfirmation.user_id == user.id
        )
    ).first()
    
    if existing_confirmation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already confirmed this sign"
        )
    
    # Create new confirmation
    confirmation = SignConfirmation(
        parking_sign_id=sign_id,
        user_id=user.id
    )
    db.add(confirmation)
    
    # Update sign
    sign.confirmation_count += 1
    sign.last_confirmed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(sign)
    
    return sign


@router.put("/{sign_id}", response_model=ParkingSignResponse)
def update_parking_sign(
    sign_id: int,
    updated_sign: ParkingSignCreate,
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Update an existing parking sign.
    
    Only the creator can update the sign.
    Resets confirmation count to 1 (requires re-verification).
    """
    user = get_current_user(authorization, db)
    
    sign = db.query(ParkingSign).filter(ParkingSign.id == sign_id).first()
    if not sign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking sign not found"
        )
    
    # Only creator can update
    if sign.created_by != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update signs you created"
        )
    
    # Update sign details
    sign.latitude = updated_sign.latitude
    sign.longitude = updated_sign.longitude
    sign.sign_type = updated_sign.sign_type
    sign.time_limit = updated_sign.time_limit
    sign.allowed_hours = updated_sign.allowed_hours
    sign.restrictions = updated_sign.restrictions
    
    # Reset confirmations since sign changed
    sign.confirmation_count = 1
    sign.last_confirmed_at = datetime.utcnow()
    
    # Delete old confirmations
    db.query(SignConfirmation).filter(
        SignConfirmation.parking_sign_id == sign_id
    ).delete()
    
    # Add creator confirmation
    confirmation = SignConfirmation(
        parking_sign_id=sign_id,
        user_id=user.id
    )
    db.add(confirmation)
    
    db.commit()
    db.refresh(sign)
    
    return sign


@router.delete("/{sign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_parking_sign(
    sign_id: int,
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Soft-delete a parking sign (marks as inactive).
    
    Only the creator can delete the sign.
    """
    user = get_current_user(authorization, db)
    
    sign = db.query(ParkingSign).filter(ParkingSign.id == sign_id).first()
    if not sign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking sign not found"
        )
    
    # Only creator can delete
    if sign.created_by != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete signs you created"
        )
    
    # Soft delete
    sign.is_active = False
    db.commit()


@router.post("/{sign_id}/report-inaccurate", status_code=status.HTTP_204_NO_CONTENT)
def report_inaccurate_sign(
    sign_id: int,
    authorization: str = Query(None, description="Bearer token"),
    db: Session = Depends(get_db)
):
    """
    Report that a parking sign's information is no longer accurate.
    
    Once reported, the sign should be reviewed by community.
    Future: Could implement voting system for deactivation.
    """
    user = get_current_user(authorization, db)
    
    sign = db.query(ParkingSign).filter(ParkingSign.id == sign_id).first()
    if not sign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parking sign not found"
        )
    
    # Future: Implement reporting/voting system
    # For now, just mark sign as potentially inactive if too many reports
    # This is a placeholder for Phase 2 voting system
    
    return None


@router.get("/stats/nearby-summary", response_model=dict)
def get_nearby_signs_summary(
    latitude: float = Query(..., description="User's current latitude"),
    longitude: float = Query(..., description="User's current longitude"),
    radius_meters: int = Query(500, description="Search radius in meters"),
    db: Session = Depends(get_db)
):
    """
    Get a summary of parking signs nearby without full details.
    
    Useful for map view showing number of signs by type.
    """
    all_signs = db.query(ParkingSign).filter(ParkingSign.is_active == True).all()
    
    # Filter by distance and categorize
    nearby_by_type = {}
    for sign in all_signs:
        distance = calculate_distance(
            latitude, longitude,
            sign.latitude, sign.longitude
        )
        
        if distance <= radius_meters:
            sign_type = sign.sign_type
            if sign_type not in nearby_by_type:
                nearby_by_type[sign_type] = 0
            nearby_by_type[sign_type] += 1
    
    return {
        "location": {"latitude": latitude, "longitude": longitude},
        "radius_meters": radius_meters,
        "signs_by_type": nearby_by_type,
        "total_signs": sum(nearby_by_type.values())
    }
