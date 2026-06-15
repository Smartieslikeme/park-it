"""Pydantic Schemas for validation and serialization"""
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


# ==================== USER SCHEMAS ====================
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== PARKING SESSION SCHEMAS ====================
class ParkingSessionBase(BaseModel):
    car_latitude: float
    car_longitude: float
    parking_type: str  # "meter" or "unrestricted"


class StartMeterParkingRequest(ParkingSessionBase):
    amount_paid: float
    hourly_rate: float


class StartMeterParkingWithTimeRequest(ParkingSessionBase):
    expires_at: datetime


class StartUnrestrictedParkingRequest(ParkingSessionBase):
    maintenance_reason: str  # "trash_pickup" or "street_cleaning"
    move_by_datetime: datetime


class ExtendMeterRequest(BaseModel):
    additional_amount: float


class UpdateLocationRequest(BaseModel):
    current_latitude: float
    current_longitude: float


class ParkingSessionResponse(ParkingSessionBase):
    id: int
    user_id: int
    parking_type: str
    amount_paid: Optional[float]
    hourly_rate: Optional[float]
    meter_expires_at: Optional[datetime]
    walking_time_minutes: Optional[int]
    should_leave_by: Optional[datetime]
    maintenance_reason: Optional[str]
    move_by_datetime: Optional[datetime]
    parked_at: datetime
    ended_at: Optional[datetime]
    is_active: bool
    last_known_latitude: Optional[float]
    last_known_longitude: Optional[float]
    distance_to_car_meters: Optional[float] = None
    time_remaining_minutes: Optional[float] = None
    
    class Config:
        from_attributes = True


# ==================== PARKING SIGN SCHEMAS ====================
class ParkingSignBase(BaseModel):
    latitude: float
    longitude: float
    sign_type: str
    time_limit: Optional[str] = None
    allowed_hours: Optional[str] = None
    restrictions: Optional[str] = None


class ParkingSignCreate(ParkingSignBase):
    pass


class ParkingSignResponse(ParkingSignBase):
    id: int
    created_by: int
    confirmation_count: int
    is_active: bool
    created_at: datetime
    last_confirmed_at: datetime
    
    class Config:
        from_attributes = True


# ==================== STREET MAINTENANCE SCHEMAS ====================
class StreetMaintenanceBase(BaseModel):
    latitude: float
    longitude: float
    maintenance_type: str  # "trash_pickup" or "street_cleaning"
    day_of_week: str
    time_start: str
    time_end: Optional[str] = None


class StreetMaintenanceCreate(StreetMaintenanceBase):
    source: str = "user_reported"


class StreetMaintenanceResponse(StreetMaintenanceBase):
    id: int
    source: str
    created_by: Optional[int]
    confirmation_count: int
    is_active: bool
    created_at: datetime
    last_confirmed_at: datetime
    
    class Config:
        from_attributes = True


# ==================== NOTIFICATION SCHEMAS ====================
class NotificationResponse(BaseModel):
    id: int
    notification_type: str
    title: str
    message: str
    sent_at: datetime
    read_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# ==================== AUTH SCHEMAS ====================
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
