#pragma once
#include <limits>
#include <string>
#include <vector>
namespace planner {
struct Point {
  double x = 0, y = 0;
};
using Ring = std::vector<Point>;
using Polygon = std::vector<Ring>;
struct StartPoint {
  std::string id;
  Point position;
};


//-----------------------------------------------------новое
struct RestrictionZone {
  std::string id;
  std::string description;
  std::string reference;
  std::string exceptions;
  Ring ring;            
  Point center;         
  double radius = 0;   
  double semiMajor = 0; 
  double semiMinor = 0; 
  double azimuthDeg = 0;
  double minAlt = 0;
  double maxAlt = 0;
};






struct Camera {
  std::string id, type;
  double focal, mx, my;
  int px, py;
};
struct UavType {
  std::string id;
  double range, homeRange, speed, minSpeed, maxSpeed, minAlt, maxAlt, radius,
      climb, descent;
  std::vector<std::string> cameras;
};
struct Uav {
  std::string id, typeId, cameraId;
  std::size_t type = 0, camera = 0;
};
struct Zone {
  Ring ring;
  Point center;
  double radius = 0;
};
struct Config {
  double clearance = 20, separation = 30, turnaround = 300, maxFlightTime = 0;
  std::size_t maxTracks = 12000, maxWaypoints = 500000;
  double calculationSeconds = 120;
};
struct PlanRequest {
  std::vector<Polygon> area;
  std::vector<StartPoint> starts;
  std::vector<Camera> cameras;
  std::vector<UavType> types;
  std::vector<Uav> uavs;
  std::vector<Zone> zones;
  //new
  std::vector<RestrictionZone> restrictions;
  std::string surveyType, criterion;
  double gsd = 0, start = 0, end = std::numeric_limits<double>::infinity();
  Config config;
  std::vector<std::string> warnings;
};
struct Waypoint {
  Point position;
  double altitude = 0, speed = 0, time = 0, photoDistance = 0;
  std::string action;
};
struct Assignment {
  std::size_t uav = 0, startPoint = 0;
  std::vector<Waypoint> waypoints;
  double distance = 0, duration = 0, takeoff = 0, landing = 0, battery = 0;
};
struct PlanResult {
  std::vector<Assignment> assignments;
  std::vector<std::string> warnings;
  //new
  std::vector<std::string> restrictionWarnings;
  double start = 0, end = 0, distance = 0;
  std::size_t used = 0;
};
} // namespace planner
