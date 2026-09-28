#include "RequestParser.hpp"
#include "EmbeddedZones.hpp"
#include "EmbeddedRestrictions.hpp"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <regex>
#include <set>
#include <sstream>
#include <stdexcept>
namespace planner {
namespace {
using J = nlohmann::json;
void require(bool b, const std::string &m) {
  if (!b)
    throw std::invalid_argument("INVALID_REQUEST: " + m);
}
double number(const J &j, const char *k, double lo = 0, bool zero = false) {
  require(j.contains(k) && j.at(k).is_number(),
          std::string(k) + " is required and must be numeric");
  double v = j.at(k).get<double>();
  require(std::isfinite(v) && (zero ? v >= lo : v > lo),
          std::string(k) + " is out of range");
  return v;
}
std::string id(const J &j) {
  auto s = j.at("id").get<std::string>();
  require(!s.empty(), "empty id");
  return s;
}
Point point(const J &j, bool leaflet = false) {
  require(j.is_array() && j.size() == 2,
          "coordinates must contain exactly two numbers");
  Point p{j.at(0).get<double>(), j.at(1).get<double>()};
  if (leaflet)
    std::swap(p.x, p.y);
  require(std::isfinite(p.x) && std::isfinite(p.y) && std::abs(p.x) <= 180 &&
              std::abs(p.y) <= 90,
          "invalid WGS84 coordinate");
  return p;
}
Ring ring(const J &j, bool leaflet = false) {
  require(j.is_array() && j.size() >= 3 && j.size() <= 20000,
          "invalid ring size");
  Ring r;
  for (auto &p : j)
    r.push_back(point(p, leaflet));
  if (r.front().x != r.back().x || r.front().y != r.back().y) {
    require(leaflet, "GeoJSON rings must be closed");
    r.push_back(r.front());
  }
  require(r.size() >= 4, "ring needs three distinct vertices");
  return r;
}
long long days(int y, unsigned m, unsigned d) {
  y -= m <= 2;
  int era = (y >= 0 ? y : y - 399) / 400;
  unsigned yy = unsigned(y - era * 400);
  unsigned doy = (153 * (m > 2 ? m - 3 : m + 9) + 2) / 5 + d - 1;
  return era * 146097LL + yy * 365 + yy / 4 - yy / 100 + doy - 719468;
}
double date(const std::string &s) {
  static const std::regex re(
      R"(^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})?$)");
  std::smatch m;
  require(std::regex_match(s, m, re), "invalid ISO8601 timestamp");
  int y = std::stoi(m[1]), mo = std::stoi(m[2]), d = std::stoi(m[3]),
      h = std::stoi(m[4]), mi = std::stoi(m[5]), se = std::stoi(m[6]);
  int md[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  if (y % 4 == 0 && (y % 100 != 0 || y % 400 == 0))
    md[1] = 29;
  require(y >= 1970 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 &&
              d <= md[mo - 1] && h < 24 && mi < 60 && se < 60,
          "timestamp out of range");
  double t = double(days(y, mo, d)) * 86400 + h * 3600 + mi * 60 + se;
  if (m[7].matched)
    t += std::stod(m[7]);
  std::string tz = m[8];
  if (!tz.empty() && tz != "Z") {
    int hh = std::stoi(tz.substr(1, 2)), mm = std::stoi(tz.substr(4, 2));
    require(hh <= 23 && mm <= 59, "invalid UTC offset");
    t -= (tz[0] == '+' ? 1 : -1) * (hh * 3600 + mm * 60);
  }
  require(t >= 0, "UTC timestamp must be on or after 1970-01-01");
  return t;
}
template <class T> void unique(const std::vector<T> &v, const char *what) {
  std::set<std::string> s;
  for (auto &x : v)
    require(s.insert(x.id).second,
            std::string("duplicate ") + what + " id " + x.id);
}
double env(const char *k, double fallback, double lo, double hi) {
  const char *s = std::getenv(k);
  if (!s)
    return fallback;
  char *end = nullptr;
  double v = std::strtod(s, &end);
  require(end != s && *end == 0 && std::isfinite(v) && v >= lo && v <= hi,
          std::string("invalid configuration ") + k);
  return v;
}
J zoneData(std::vector<std::string> &warnings) {
  const char *overridePath = std::getenv("PLANNER_NO_FLY_ZONES");
  if (overridePath) {
    std::ifstream f(overridePath);
    if (!f)
      throw std::runtime_error("ZONE_DATA: cannot open PLANNER_NO_FLY_ZONES");
    return J::parse(f);
  }
  for (const auto &path :
       {std::string("cpp-module/no-fly-zons/no_fly_zones.json"),
        std::string("no-fly-zons/no_fly_zones.json"),
        std::string(PLANNER_ZONE_SOURCE)}) {
    std::ifstream f(path);
    if (f)
      return J::parse(f);
  }
  warnings.push_back("No external zone file found; using the exact "
                     "no-fly-zons/no_fly_zones.json snapshot embedded at build "
                     "time. Rebuild or set PLANNER_NO_FLY_ZONES to update.");
  return J::parse(embeddedZones);
}



//---------------------------------------------------------------------------новое
J restrictionData(std::vector<std::string> &warnings) {
  const char *overridePath = std::getenv("PLANNER_RESTRICTION_ZONES");
  if (overridePath) {
    std::ifstream f(overridePath);
    if (!f)
      throw std::runtime_error(
          "ZONE_DATA: cannot open PLANNER_RESTRICTION_ZONES");
    return J::parse(f);
  }
  for (const auto &path :
       {std::string("cpp-module/no-fly-zons/restriction_zones.json"),
        std::string("no-fly-zons/restriction_zones.json")}) {
    std::ifstream f(path);
    if (f)
      return J::parse(f);
  }
  warnings.push_back("No external restriction_zones.json found; using the "
                    "exact snapshot embedded at build time. Rebuild or set "
                    "PLANNER_RESTRICTION_ZONES to update.");
  return J::parse(embeddedRestrictions);
}




} // namespace
std::string timestamp(double t) {
  if (!std::isfinite(t) || t < 0 || t > 253402300799.0)
    throw std::runtime_error(
        "RESOURCE_LIMIT: result timestamp is out of range");
  // Integer civil calendar conversion, independent of platform time_t and
  // locale.
  long long ms = std::llround(t * 1000), sec = ms / 1000,
            z = sec / 86400 + 719468;
  long long era = (z >= 0 ? z : z - 146096) / 146097;
  unsigned doe = unsigned(z - era * 146097);
  unsigned yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  int y = int(yoe) + int(era) * 400;
  unsigned doy = doe - (365 * yoe + yoe / 4 - yoe / 100),
           mp = (5 * doy + 2) / 153, d = doy - (153 * mp + 2) / 5 + 1,
           m = mp < 10 ? mp + 3 : mp - 9;
  y += m <= 2;
  std::ostringstream o;
  o << std::setfill('0') << std::setw(4) << y << '-' << std::setw(2) << m << '-'
    << std::setw(2) << d << 'T' << std::setw(2) << (sec % 86400) / 3600 << ':'
    << std::setw(2) << (sec % 3600) / 60 << ':' << std::setw(2) << sec % 60
    << '.' << std::setw(3) << ms % 1000 << 'Z';
  return o.str();
}
PlanRequest RequestParser::parse(const J &j) const {
  require(j.is_object(), "request must be an object");
  PlanRequest r;
  r.gsd = number(j, "gsd");
  require(r.gsd >= .1 && r.gsd <= 100, "gsd must be in [0.1,100] cm/pixel");
  r.surveyType = j.at("survey_type").get<std::string>();
  require(r.surveyType == "RGB" || r.surveyType == "multispectral" ||
              r.surveyType == "Thermal",
          "unsupported survey_type: no LiDAR/geophysical sensor parameters in "
          "current API");
  r.criterion = j.value("optimization_criteria", std::string("min_time"));
  require(r.criterion == "min_time" || r.criterion == "min_flight_distance",
          "unknown optimization_criteria");
  const auto &a = j.at("survey_area");
  std::string at = a.at("type");
  require(at == "Polygon" || at == "MultiPolygon", "unknown geometry type");
  auto add = [&](const J &p) {
    require(p.is_array() && !p.empty(), "empty polygon");
    Polygon poly;
    for (auto &rr : p)
      poly.push_back(ring(rr));
    r.area.push_back(poly);
  };
  if (at == "Polygon")
    add(a.at("coordinates"));
  else
    for (auto &p : a.at("coordinates"))
      add(p);
  require(!r.area.empty() && r.area.size() <= 100, "invalid polygon count");
  for (auto &s : j.at("start_points"))
    r.starts.push_back({id(s), point(s.at("coordinates"))});
  require(!r.starts.empty() && r.starts.size() <= 100,
          "need 1..100 start points");
  unique(r.starts, "start point");
  for (auto &c : j.at("cameras")) {
    Camera cam;
    cam.id = id(c);
    cam.type = c.at("type");
    require(cam.type == "RGB" || cam.type == "Multispectral" ||
                cam.type == "Thermal",
            "invalid camera type");
    cam.focal = number(c, "focalLength");
    cam.mx = number(c, "matrixX");
    cam.my = number(c, "matrixY");
    double px = number(c, "matrixPixX"), py = number(c, "matrixPixY");
    require(px <= 1000000 && py <= 1000000 && px == std::floor(px) &&
                py == std::floor(py),
            "invalid pixel count");
    cam.px = int(px);
    cam.py = int(py);
    require(cam.focal >= 1e-6 && cam.focal <= 1e6 && cam.mx >= 1e-6 &&
                cam.mx <= 1e6 && cam.my >= 1e-6 && cam.my <= 1e6,
            "camera dimensions outside supported numeric range");
    r.cameras.push_back(cam);
  }
  unique(r.cameras, "camera");
  for (auto &t : j.at("uav_types")) {
    UavType u;
    u.id = id(t);
    u.range = number(t, "max_flight_distance");
    u.homeRange = number(t, "max_distance_from_home");
    u.speed = number(t, "cruise_speed");
    u.minSpeed = number(t, "min_speed", 0, true);
    u.maxSpeed = number(t, "max_speed");
    u.minAlt = number(t, "min_alt", 0, true);
    u.maxAlt = number(t, "max_alt");
    u.radius = number(t, "min_turn_radius", 0, true);
    u.climb = number(t, "climb_speed");
    u.descent = number(t, "descent_speed");
    number(t, "min_voltage", 0, true);
    u.cameras = t.at("cameras").get<std::vector<std::string>>();
    require(u.minAlt <= u.maxAlt && u.minSpeed <= u.speed &&
                u.speed <= u.maxSpeed,
            "inconsistent UAV limits");
    require(u.radius > 0 || u.minSpeed == 0,
            "positive min_speed requires positive min_turn_radius");
    require(u.range <= 1e8 && u.homeRange <= 1e7 && u.speed >= 0.01 &&
                u.climb >= 0.001 && u.descent >= 0.001 &&
                (u.radius == 0 || u.radius >= 0.01) && u.maxSpeed <= 1000 &&
                u.maxAlt <= 100000 && u.radius <= 100000 && u.climb <= 1000 &&
                u.descent <= 1000,
            "UAV values exceed supported numeric range");
    r.types.push_back(u);
  }
  unique(r.types, "UAV type");
  for (auto &u : j.at("uavs")) {
    Uav v;
    v.id = id(u);
    v.typeId = u.at("type_id");
    v.cameraId = u.at("camera_id");
    auto t = std::find_if(r.types.begin(), r.types.end(),
                          [&](auto &x) { return x.id == v.typeId; });
    auto c = std::find_if(r.cameras.begin(), r.cameras.end(),
                          [&](auto &x) { return x.id == v.cameraId; });
    require(t != r.types.end() && c != r.cameras.end(),
            "broken UAV type/camera reference");
    require(std::find(t->cameras.begin(), t->cameras.end(), v.cameraId) !=
                t->cameras.end(),
            "incompatible UAV camera");
    v.type = std::size_t(t - r.types.begin());
    v.camera = std::size_t(c - r.cameras.begin());
    r.uavs.push_back(v);
  }
  unique(r.uavs, "UAV");
  require(!r.uavs.empty() && r.uavs.size() <= 100, "need 1..100 UAVs");
  r.start = std::chrono::duration<double>(
                std::chrono::system_clock::now().time_since_epoch())
                .count();
  if (j.contains("operation_start_time") &&
      !j.at("operation_start_time").is_null())
    r.start = date(j.at("operation_start_time").get<std::string>());
  else
    r.warnings.push_back(
        "operation_start_time omitted: current UTC time used.");
  if (j.contains("operation_end_time") && !j.at("operation_end_time").is_null())
    r.end = date(j.at("operation_end_time").get<std::string>());
  require(r.end > r.start, "operation_end_time must be later than start");
  r.config.clearance = env("PLANNER_CLEARANCE_M", 20, 1, 1000);
  r.config.separation = env("PLANNER_SEPARATION_M", 30, 1, 1000);
  r.config.turnaround = env("PLANNER_TURNAROUND_SECONDS", 300, 0, 86400);
  r.config.maxFlightTime = env("PLANNER_MAX_FLIGHT_TIME_SECONDS", 0, 0, 86400);
  r.config.calculationSeconds =
      env("PLANNER_CALCULATION_SECONDS", 120, 1, 1800);
  auto zones = zoneData(r.warnings);
  require(zones.at("zones").is_array(), "invalid zone database");
  for (auto &z : zones.at("zones")) {
    Zone zone;
    std::string type = z.at("type");
    if (type == "polygon")
      zone.ring = ring(z.at("coordinates"), true);
    else if (type == "circle") {
      zone.center = point(z.at("center"), true);
      zone.radius = number(z, "radius_km") * 1000;
      require(zone.radius <= 2000000, "zone radius exceeds supported range");
    } else
      throw std::runtime_error("ZONE_DATA: unknown zone type");
    r.zones.push_back(zone);
  }
    require(!r.zones.empty(), "zone database must not be empty");

  //------------------------------------------------------------новое
  auto restrictions = restrictionData(r.warnings);
  require(restrictions.contains("zones") && restrictions.at("zones").is_array(),
          "invalid restriction zone database");
  for (auto &z : restrictions.at("zones")) {
    RestrictionZone rz;
    rz.id = z.at("id").get<std::string>();

    if (z.contains("schedule") && z.at("schedule").is_object())
      rz.description = z.at("schedule").value("description", std::string(""));
    if (z.contains("exceptions"))
      rz.exceptions = z.at("exceptions").get<std::string>();

    if (z.contains("altitude") && z.at("altitude").is_object()) {
    auto &alt = z.at("altitude");
    auto numOr = [](const J &j, const char *k, double fallback) -> double {
      if (!j.contains(k)) return fallback;
      const auto &v = j.at(k);
      if (v.is_null() || !v.is_number()) return fallback;
      return v.get<double>();
    };
    rz.minAlt = numOr(alt, "min_m", 0.0);
    rz.maxAlt = numOr(alt, "max_m", 0.0);
    rz.reference = alt.value("reference", std::string(""));
}

    std::string type = z.at("type").get<std::string>();
    if (type == "polygon") {
      rz.ring = ring(z.at("coordinates"), true);
    } else if (type == "circle") {
      rz.center = point(z.at("center"), true);
      rz.radius = number(z, "radius_km") * 1000;
    } else if (type == "ellipse") {
      rz.center = point(z.at("center"), true);
      auto axes = z.at("semi_axes_km");
      require(axes.is_array() && axes.size() == 2, "ellipse axes");
      rz.semiMajor = axes.at(0).get<double>() * 1000;
      rz.semiMinor = axes.at(1).get<double>() * 1000;
      rz.azimuthDeg = z.value("azimuth_deg", 0.0);
    } else {
      throw std::runtime_error(
          "ZONE_DATA: unknown restriction zone type: " + type);
    }
    r.restrictions.push_back(std::move(rz));
  }

  return r;
}
} // namespace planner
