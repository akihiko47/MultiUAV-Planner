import io
import zipfile
from collections import Counter
from typing import List
from urllib.parse import quote
from xml.sax.saxutils import escape

from app.models import PlanResponse, UAVAssignment

#  Mission Planner: .waypoints
def _waypoint_line(
    seq: int,
    lat: float,
    lon: float,
    alt: float,
    command: int,
    param1: float = 0.0,
    param2: float = 0.0,
    param3: float = 0.0,
    param4: float = 0.0,
) -> str:
    """
    Формат QGC WPL 110:
    seq current frame command param1 param2 param3 param4 lat lon alt autocontinue
    """
    return (
        f"{seq}\t0\t3\t{command}\t"
        f"{param1:.6f}\t{param2:.6f}\t{param3:.6f}\t{param4:.6f}\t"
        f"{lat:.7f}\t{lon:.7f}\t{alt:.2f}\t1"
    )


# ArduPilot MAVLink command IDs
CMD_NAV_WAYPOINT = 16
CMD_NAV_TAKEOFF = 22
CMD_NAV_LAND = 21
CMD_DO_SET_HOME = 177
CMD_DO_SET_CAM_TRIGG_DIST = 206


def _action_to_command(action: str) -> int:
    if action == "takeoff":
        return CMD_NAV_TAKEOFF
    if action == "landing":
        return CMD_NAV_LAND
    return CMD_NAV_WAYPOINT


def build_mission_planner_file(assignment: UAVAssignment) -> str:
    lines: List[str] = ["QGC WPL 110"]
    seq = 0

    # HOME — берём точку старта
    home_lon, home_lat = assignment.start_point.coordinates
    lines.append(
        _waypoint_line(seq, home_lat, home_lon, 0.0,
                       CMD_DO_SET_HOME, param1=1.0, param2=0.0)
    )
    seq += 1

    for wp in assignment.waypoints:
        lon, lat = wp.coordinates
        cmd = _action_to_command(wp.action)

        # Waypoint (сама точка)
        lines.append(
            _waypoint_line(seq, lat, lon, wp.altitude, cmd,
                           param4=wp.speed if wp.speed > 0 else 0.0)
        )
        seq += 1

        # Начало съёмки — включаем триггер с интервалом по дистанции
        if wp.action == "line_begin":
            dist = float(wp.photo_distance) if wp.photo_distance else 0.0
            lines.append(
                _waypoint_line(seq, lat, lon, wp.altitude,
                               CMD_DO_SET_CAM_TRIGG_DIST,
                               param1=dist)
            )
            seq += 1

        # Конец съёмки — отключаем триггер
        if wp.action == "line_end":
            lines.append(
                _waypoint_line(seq, lat, lon, wp.altitude,
                               CMD_DO_SET_CAM_TRIGG_DIST,
                               param1=0.0)
            )
            seq += 1

    return "\n".join(lines) + "\n"


def build_mission_planner_zip(plan: PlanResponse) -> bytes:
    buf = io.BytesIO()
    totals = Counter(a.uav_id for a in plan.uav_assignments)
    sorties = Counter()
    used_names = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for a in plan.uav_assignments:
            sorties[a.uav_id] += 1
            stem = quote(a.uav_id, safe="-_") or "uav"
            if totals[a.uav_id] > 1:
                stem += f"_sortie_{sorties[a.uav_id]}"
            filename = f"{stem}.waypoints"
            suffix = 2
            while filename in used_names:
                filename = f"{stem}_{suffix}.waypoints"
                suffix += 1
            used_names.add(filename)
            content = build_mission_planner_file(a)
            zf.writestr(filename, content)
    return buf.getvalue()


#  Geoscan Planner: .kml
def _kml_color(hex_rgb: str = "ff0000ff") -> str:
    # KML использует aabbggrr
    return hex_rgb


def _kml_coords(assignment: UAVAssignment) -> str:
    parts = []
    for lon, lat in assignment.route.coordinates:
        # берём высоту первой waypoint-точки как общую
        parts.append(f"{lon},{lat},0")
    return " ".join(parts)


def _kml_waypoints(assignment: UAVAssignment) -> str:
    placemarks = []
    for wp in assignment.waypoints:
        lon, lat = wp.coordinates
        placemarks.append(f"""
        <Placemark>
            <name>{wp.sequence}: {wp.action}</name>
            <description><![CDATA[
                action: {wp.action}<br/>
                altitude: {wp.altitude:.2f} m<br/>
                speed: {wp.speed:.2f} m/s<br/>
                time: {wp.time.isoformat()}<br/>
                photo_distance: {wp.photo_distance}
            ]]></description>
            <Point>
                <coordinates>{lon},{lat},{wp.altitude:.2f}</coordinates>
            </Point>
        </Placemark>""")
    return "\n".join(placemarks)


def build_geoscan_kml(plan: PlanResponse) -> str:
    styles = ""
    for i, a in enumerate(plan.uav_assignments):
        color = ["ff0000ff", "ff00ff00", "ffff0000", "ffffff00",
                 "ffff00ff", "ff00ffff"][i % 6]
        styles += f"""
    <Style id="route_{i}">
        <LineStyle>
            <color>{color}</color>
            <width>3</width>
        </LineStyle>
        <IconStyle>
            <color>{color}</color>
        </IconStyle>
    </Style>"""

    folders = ""
    for i, a in enumerate(plan.uav_assignments):
        folders += f"""
    <Folder>
        <name>{escape(a.uav_id)} ({escape(a.type_id)})</name>
        <description><![CDATA[
            camera: {a.camera_id.replace(']]>', ']]]]><![CDATA[>')}<br/>
            takeoff: {a.takeoff_time.isoformat()}<br/>
            landing: {a.landing_time.isoformat()}<br/>
            estimated_time: {a.estimated_time:.2f} s<br/>
            estimated_distance: {a.estimated_distance:.2f} m<br/>
            battery_usage: {a.battery_usage:.2f} %
        ]]></description>

        <Placemark>
            <name>Маршрут {escape(a.uav_id)}</name>
            <styleUrl>#route_{i}</styleUrl>
            <LineString>
                <tessellate>1</tessellate>
                <altitudeMode>absolute</altitudeMode>
                <coordinates>{_kml_coords(a)}</coordinates>
            </LineString>
        </Placemark>

        {_kml_waypoints(a)}
    </Folder>"""

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
    <name>UAV Mission Plan</name>
    {styles}
    {folders}
</Document>
</kml>
"""

def build_geoscan_kml_bytes(plan: PlanResponse) -> bytes:
    return build_geoscan_kml(plan).encode("utf-8")
