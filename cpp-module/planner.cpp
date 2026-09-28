#include "planner.hpp"
#include "Planner/Planner.hpp"
#include "Planner/RequestParser.hpp"
#include <cstdlib>
#include <cstring>
#include <new>
#include <nlohmann/json.hpp>
#include <string>
namespace {
using J = nlohmann::json;
char *allocate(const std::string &s) {
  char *p = static_cast<char *>(std::malloc(s.size() + 1));
  if (!p)
    throw std::bad_alloc();
  std::memcpy(p, s.c_str(), s.size() + 1);
  return p;
}
J xy(planner::Point p) { return J::array({p.x, p.y}); }
J serialize(const planner::PlanRequest &req, const planner::PlanResult &plan) {
  J assignments = J::array();
  for (auto &a : plan.assignments) {
    auto &u = req.uavs[a.uav];
    auto &s = req.starts[a.startPoint];
    J waypoints = J::array(), route = J::array();
    int seq = 0;
    for (auto &w : a.waypoints) {
      J j = {{"sequence", seq++},      {"coordinates", xy(w.position)},
             {"altitude", w.altitude}, {"speed", w.speed},
             {"action", w.action},     {"time", planner::timestamp(w.time)}};
      if (w.action == "line_begin")
        j["photo_distance"] = w.photoDistance;
      waypoints.push_back(j);
      route.push_back(xy(w.position));
    }
    J base = {{"id", s.id}, {"coordinates", xy(s.position)}};
    assignments.push_back(
        {{"uav_id", u.id},
         {"type_id", u.typeId},
         {"camera_id", u.cameraId},
         {"takeoff_time", planner::timestamp(a.takeoff)},
         {"landing_time", planner::timestamp(a.landing)},
         {"start_point", base},
         {"landing_point", base},
         {"route", {{"type", "LineString"}, {"coordinates", route}}},
         {"waypoints", waypoints},
         {"estimated_time", a.duration},
         {"estimated_distance", a.distance},
         {"battery_usage", a.battery}});
  }
  return {{"summary",
           {{"optimization_criteria", req.criterion},
            {"total_time", plan.end - plan.start},
            {"total_distance", plan.distance},
            {"uavs_used", plan.used},
            {"uavs_total", req.uavs.size()},
            {"operation_start", planner::timestamp(plan.start)},
            {"operation_end", planner::timestamp(plan.end)}}},
          {"uav_assignments", assignments},
          {"restriction_warnings", plan.restrictionWarnings}, 
          {"warnings", plan.warnings}};
}
} // namespace
extern "C" char *plan_json(const char *request) {
  try {
    if (!request)
      throw std::invalid_argument("INVALID_REQUEST: null input");
    if (std::strlen(request) > 8 * 1024 * 1024)
      throw std::invalid_argument("RESOURCE_LIMIT: request exceeds 8 MiB");
    auto r = planner::RequestParser{}.parse(J::parse(request));
    auto result = planner::Planner{}.plan(r);
    return allocate(serialize(r, result).dump());
  } catch (const std::exception &e) {
    try {
      return allocate(J({{"error", e.what()}}).dump());
    } catch (...) {
      return nullptr;
    }
  } catch (...) {
    try {
      return allocate("{\"error\":\"INTERNAL_ERROR: unknown exception\"}");
    } catch (...) {
      return nullptr;
    }
  }
}
extern "C" void free_string(char *p) { std::free(p); }
