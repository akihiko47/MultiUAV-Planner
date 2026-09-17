from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


SurveyType = Literal["RGB", "multispectral", "IR", "LiDAR", "geophysical"]
OptimizationCriteria = Literal["min_time", "min_flight_distance"]


class SurveyArea(BaseModel):
    type: Literal["Polygon"]
    coordinates: List[List[List[float]]]


class StartPoint(BaseModel):
    id: str
    coordinates: List[float]  # [lon, lat]


class UAVType(BaseModel):
    id: str
    name: Optional[str] = None
    max_flight_time: float
    cruise_speed: float
    max_speed: Optional[float] = None
    battery_capacity: Optional[float] = None
    supported_survey_types: List[SurveyType]


class UAV(BaseModel):
    id: str
    type_id: str


class PlanRequest(BaseModel):
    survey_area: SurveyArea
    start_points: List[StartPoint]
    uav_types: List[UAVType]
    uavs: List[UAV]
    survey_type: SurveyType
    optimization_criteria: OptimizationCriteria = "min_time"
    operation_start_time: Optional[datetime] = None
    operation_end_time: Optional[datetime] = None


class Summary(BaseModel):
    optimization_criteria: str
    total_time: float
    total_distance: float
    uavs_used: int
    uavs_total: int
    operation_start: datetime
    operation_end: datetime


class Waypoint(BaseModel):
    sequence: int
    coordinates: List[float]
    altitude: float
    speed: float
    action: Literal[
        "takeoff",
        "transit",
        "survey_start",
        "survey_end",
        "waypoint",
        "landing",
    ]
    time: datetime


class Route(BaseModel):
    type: Literal["LineString"]
    coordinates: List[List[float]]


class UAVAssignment(BaseModel):
    uav_id: str
    type_id: str
    takeoff_time: datetime
    landing_time: datetime
    start_point: StartPoint
    landing_point: StartPoint
    route: Route
    waypoints: List[Waypoint]
    estimated_time: float
    estimated_distance: float
    battery_usage: float


class PlanResponse(BaseModel):
    summary: Summary
    uav_assignments: List[UAVAssignment]
    warnings: List[str] = Field(default_factory=list)