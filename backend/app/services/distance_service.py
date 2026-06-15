"""Distance and walking time calculation service"""
import math
from typing import Tuple


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates using Haversine formula.
    Returns distance in meters.
    """
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    
    distance = R * c
    return distance


def calculate_walking_time(distance_meters: float) -> int:
    """
    Calculate walking time to cover distance.
    Average walking speed: 1.4 m/s (5 km/h)
    Returns time in minutes.
    """
    WALKING_SPEED_MS = 1.4  # meters per second
    
    time_seconds = distance_meters / WALKING_SPEED_MS
    time_minutes = time_seconds / 60
    
    return int(round(time_minutes))


def get_distance_and_walking_time(
    user_lat: float,
    user_lon: float,
    car_lat: float,
    car_lon: float
) -> Tuple[float, int]:
    """
    Calculate both distance and walking time.
    Returns (distance_meters, walking_time_minutes)
    """
    distance = calculate_distance(user_lat, user_lon, car_lat, car_lon)
    walking_time = calculate_walking_time(distance)
    return distance, walking_time
