from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


SurveyType = Literal["RGB", "multispectral", "Thermal", "LiDAR", "geophysical"]
CameraType = Literal["RGB", "Multispectral", "Thermal"]
OptimizationCriteria = Literal["min_time", "min_flight_distance"]


# Соответствие типа камеры и типа съёмки.
# LiDAR и geophysical не имеют соответствующего типа камеры в каталоге,
# поэтому такие запросы всегда будут отклоняться валидатором ниже.
CAMERA_TYPE_TO_SURVEY: Dict[str, str] = {
    "RGB": "RGB",
    "Multispectral": "multispectral",
    "Thermal": "Thermal",
}


class SurveyArea(BaseModel):
    type: Literal["Polygon"]
    coordinates: List[List[List[float]]]


class StartPoint(BaseModel):
    id: str
    coordinates: List[float]  # [lon, lat]


class Camera(BaseModel):
    id: str
    name: Optional[str] = None
    type: CameraType
    focalLength: float
    matrixX: float
    matrixY: float
    matrixPixX: int
    matrixPixY: int


class UAVType(BaseModel):
    id: str
    name: Optional[str] = None
    max_flight_distance: float
    max_distance_from_home: float
    cruise_speed: float
    min_speed: float
    max_speed: float
    min_alt: float
    max_alt: float
    min_turn_radius: float
    min_voltage: float
    climb_speed: float
    descent_speed: float
    cameras: List[str]  # id камер, совместимых с этим типом


class UAV(BaseModel):
    id: str
    type_id: str
    camera_id: str


class PlanRequest(BaseModel):
    survey_area: SurveyArea
    start_points: List[StartPoint]
    uav_types: List[UAVType]
    cameras: List[Camera]
    uavs: List[UAV]
    survey_type: SurveyType
    optimization_criteria: OptimizationCriteria = "min_time"
    operation_start_time: Optional[datetime] = None
    operation_end_time: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_references(self):
        # 1. Ссылочная целостность
        uav_types_by_id = {t.id: t for t in self.uav_types}
        cameras_by_id = {c.id: c for c in self.cameras}

        for uav in self.uavs:
            if uav.type_id not in uav_types_by_id:
                raise ValueError(
                    f"UAV '{uav.id}': type_id '{uav.type_id}' "
                    f"not found in uav_types"
                )
            if uav.camera_id not in cameras_by_id:
                raise ValueError(
                    f"UAV '{uav.id}': camera_id '{uav.camera_id}' "
                    f"not found in cameras"
                )
            ut = uav_types_by_id[uav.type_id]
            if uav.camera_id not in ut.cameras:
                raise ValueError(
                    f"UAV '{uav.id}': camera '{uav.camera_id}' "
                    f"is not compatible with UAV type '{uav.type_id}'"
                )

        # 2. Тип съёмки должен поддерживаться хотя бы одной камерой
        if self.survey_type not in CAMERA_TYPE_TO_SURVEY.values():
            supported = ", ".join(sorted(set(CAMERA_TYPE_TO_SURVEY.values())))
            raise ValueError(
                f"Survey type '{self.survey_type}' is not supported by any "
                f"camera type in the catalog. Supported types: {supported}"
            )

        # 3. Хотя бы один БВС должен быть способен выполнить эту съёмку
        capable_uavs = [
            uav for uav in self.uavs
            if CAMERA_TYPE_TO_SURVEY.get(cameras_by_id[uav.camera_id].type)
            == self.survey_type
        ]
        if not capable_uavs:
            raise ValueError(
                f"No UAV in the request can perform survey type "
                f"'{self.survey_type}'. Check that at least one UAV has "
                f"a camera whose type matches the requested survey type."
            )

        return self


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
        "line_begin",
        "line_end",
        "waypoint",
        "landing",
    ]
    photo_distance: Optional[float] = None
    time: datetime

    @model_validator(mode="after")
    def validate_photo_distance(self):
        if self.action == "line_begin":
            if self.photo_distance is None:
                raise ValueError(
                    "photo_distance is required when action='line_begin'"
                )
            if self.photo_distance <= 0:
                raise ValueError(
                    f"photo_distance must be positive, got {self.photo_distance}"
                )
        else:
            if self.photo_distance is not None:
                raise ValueError(
                    f"photo_distance is only allowed for action='line_begin', "
                    f"got action='{self.action}'"
                )
        return self


class Route(BaseModel):
    type: Literal["LineString"]
    coordinates: List[List[float]]


class UAVAssignment(BaseModel):
    uav_id: str
    type_id: str
    camera_id: str
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