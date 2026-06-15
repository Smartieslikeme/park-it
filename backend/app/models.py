"""Database Models"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class User(Base):
    """User Model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    parking_sessions = relationship("ParkingSession", back_populates="user")
    parking_signs = relationship("ParkingSign", back_populates="created_by_user")
    maintenance = relationship("StreetMaintenance", back_populates="created_by_user")
    confirmations = relationship("SignConfirmation", back_populates="user")


class ParkingSession(Base):
    """Active or historical parking session"""
    __tablename__ = "parking_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    
    # Location
    car_latitude = Column(Float)
    car_longitude = Column(Float)
    
    # Parking type
    parking_type = Column(String)  # "meter" or "unrestricted"
    
    # Meter specific
    amount_paid = Column(Float, nullable=True)  # dollars
    hourly_rate = Column(Float, nullable=True)  # dollars/hour
    meter_expires_at = Column(DateTime, nullable=True)
    walking_time_minutes = Column(Integer, nullable=True)
    should_leave_by = Column(DateTime, nullable=True)
    
    # Unrestricted specific
    maintenance_reason = Column(String, nullable=True)  # "trash_pickup" or "street_cleaning"
    move_by_datetime = Column(DateTime, nullable=True)
    
    # Tracking
    parked_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Notifications sent
    leave_notification_sent = Column(Boolean, default=False)
    meter_expired_notification_sent = Column(Boolean, default=False)
    geofence_warning_sent = Column(Boolean, default=False)
    
    # Geofencing
    last_known_latitude = Column(Float, nullable=True)
    last_known_longitude = Column(Float, nullable=True)
    max_distance_from_car_meters = Column(Float, default=500)  # meters
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="parking_sessions")


class ParkingSign(Base):
    """Crowdsourced parking sign information"""
    __tablename__ = "parking_signs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Location
    latitude = Column(Float, index=True)
    longitude = Column(Float, index=True)
    
    # Sign details
    sign_type = Column(String)  # "time_limit", "permit", "no_parking", etc.
    time_limit = Column(String, nullable=True)  # "2 hours", "4 hours", etc.
    allowed_hours = Column(String, nullable=True)  # "9am-6pm Mon-Fri"
    restrictions = Column(Text, nullable=True)  # detailed restrictions
    photo_url = Column(String, nullable=True)
    
    # Crowdsourcing
    created_by = Column(Integer, ForeignKey("users.id"))
    confirmation_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    last_confirmed_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    created_by_user = relationship("User", back_populates="parking_signs")
    confirmations = relationship("SignConfirmation", back_populates="parking_sign")


class SignConfirmation(Base):
    """User confirmations that parking sign info is still accurate"""
    __tablename__ = "sign_confirmations"
    
    id = Column(Integer, primary_key=True, index=True)
    parking_sign_id = Column(Integer, ForeignKey("parking_signs.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    
    confirmed_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    parking_sign = relationship("ParkingSign", back_populates="confirmations")
    user = relationship("User", back_populates="confirmations")


class StreetMaintenance(Base):
    """Street cleaning or trash pickup schedule"""
    __tablename__ = "street_maintenance"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Location
    latitude = Column(Float, index=True)
    longitude = Column(Float, index=True)
    
    # Maintenance type
    maintenance_type = Column(String)  # "trash_pickup" or "street_cleaning"
    
    # Schedule
    day_of_week = Column(String)  # "Monday", "Tuesday", etc.
    time_start = Column(String)  # "7:00 AM"
    time_end = Column(String, nullable=True)  # "11:00 AM" (for street cleaning)
    
    # Source
    source = Column(String)  # "user_reported", "city_api", "manual"
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Crowdsourcing
    confirmation_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    last_confirmed_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    created_by_user = relationship("User", back_populates="maintenance")


class Notification(Base):
    """Notification history"""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    
    notification_type = Column(String)  # "meter_warning", "meter_expired", "leave_now", etc.
    title = Column(String)
    message = Column(Text)
    
    # Related entities
    parking_session_id = Column(Integer, ForeignKey("parking_sessions.id"), nullable=True)
    
    sent_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
