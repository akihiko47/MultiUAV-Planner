#include "Planner.hpp"
#include "Geometry.hpp"
extern "C" {
#include "dubins.h"
}
#include <algorithm>
#include <cmath>
#include <limits>
#include <map>
#include <set>
#include <stdexcept>
#include <tuple>
namespace planner {
namespace {
struct Vehicle {
  std::size_t index;
  double altitude, width, photo;
};
struct Pose {
  Point p;
  double heading;
};
struct Flight {
  Assignment assignment;
  Pose pose;
};
double heading(Point a, Point b) { return std::atan2(b.y - a.y, b.x - a.x); }
std::vector<Point> dubins(Pose a, Pose b, double radius, const Geometry &g) {
  if (distance(a.p, b.p) < 1e-5 &&
      std::abs(std::remainder(a.heading - b.heading, 2 * pi)) < 1e-7)
    return {a.p, b.p};
  double q0[] = {a.p.x, a.p.y, a.heading}, q1[] = {b.p.x, b.p.y, b.heading};
  double best = 1e100;
  std::vector<Point> result;
  for (int type = 0; type < 6; ++type) {
    g.deadline.check();
    DubinsPath path;
    if (dubins_path(&path, q0, q1, radius, static_cast<DubinsPathType>(type)))
      continue;
    double length = dubins_path_length(&path);
    if (length >= best)
      continue;
    double step = std::min(25., radius * .08);
    if (length / step > 100000)
      continue;
    std::vector<double> samples{0, length};
    double offset = 0;
    for (int k = 0; k < 3; ++k) {
      double len = dubins_segment_length(&path, k);
      int count = std::max(1, int(std::ceil(len / step)));
      for (int i = 1; i <= count; ++i)
        samples.push_back(offset + len * double(i) / count);
      offset += len;
    }
    std::sort(samples.begin(), samples.end());
    std::vector<Point> points{a.p};
    bool safe = true;
    for (double s : samples) {
      if (s < 1e-6 || s >= length - 1e-6)
        continue;
      double q[3];
      if (dubins_path_sample(&path, s, q)) {
        safe = false;
        break;
      }
      Point p{q[0], q[1]};
      if (!g.clear(points.back(), p)) {
        safe = false;
        break;
      }
      if (distance(points.back(), p) > 1e-6)
        points.push_back(p);
    }
    if (!safe || !g.clear(points.back(), b.p))
      continue;
    points.push_back(b.p);
    best = length;
    result = std::move(points);
  }
  return result;
}
std::vector<Point> connection(Pose a, Pose b, const UavType &u,
                              const Geometry &g) {
  if (u.radius == 0)
    return g.route(a.p, b.p);
  // Radius includes a projection/chord margin. Check all six Dubins words.
  double rad = u.radius * 1.03;
  auto direct = dubins(a, b, rad, g);
  if (!direct.empty())
    return direct;
  auto corners = g.route(a.p, b.p, rad * 3);
  if (corners.empty())
    return {};
  std::vector<Point> out{a.p};
  Pose from = a;
  for (std::size_t i = 1; i < corners.size(); ++i) {
    Pose to{i + 1 == corners.size() ? b.p : corners[i],
            i + 1 == corners.size() ? b.heading
                                    : heading(corners[i], corners[i + 1])};
    auto part = dubins(from, to, rad, g);
    if (part.empty())
      return {};
    out.insert(out.end(), part.begin() + 1, part.end());
    from = to;
  }
  return out;
}
void append(Assignment &a, Point p, double altitude, double speed,
            const std::string &action, double dt, double photo = 0) {
  double time = a.waypoints.empty() ? 0 : a.waypoints.back().time + dt;
  if (!a.waypoints.empty()) {
    auto &prev = a.waypoints.back();
    a.distance +=
        std::hypot(distance(prev.position, p), altitude - prev.altitude);
  }
  a.waypoints.push_back({p, altitude, speed, time, photo, action});
  a.duration = time;
}
void follow(Assignment &a, const std::vector<Point> &path, double altitude,
            double speed) {
  for (std::size_t i = 1; i < path.size(); ++i) {
    double d = distance(a.waypoints.back().position, path[i]);
    if (d > 1e-6)
      append(a, path[i], altitude, speed, "transit", d / speed);
  }
}
bool vertical(Assignment &a, Pose home, double altitude, bool up,
              const UavType &u, const Geometry &g) {
  double vz = up ? u.climb : u.descent;
  if (u.radius == 0) {
    append(a, home.p, up ? altitude : 0, 0, up ? "transit" : "landing",
           altitude / vz);
    return true;
  }
  double radius =
      std::max(u.radius * 1.03, u.speed * altitude / vz / (2 * pi) * 1.01);
  if (radius > 10000)
    return false;
  // Helix starts and ends at the launch point with the same tangent. It may
  // be rejected near obstacles; never replace it with an impossible hover.
  for (int sign : {1, -1}) {
    Assignment test = a;
    Point normal{-std::sin(home.heading) * sign, std::cos(home.heading) * sign};
    Point center = home.p + normal * radius;
    double angle = std::atan2(home.p.y - center.y, home.p.x - center.x);
    int n = std::max(80, int(std::ceil(2 * pi * radius / 25)));
    bool safe = true;
    for (int i = 1; i <= n; ++i) {
      double f = double(i) / n, t = angle + sign * 2 * pi * f;
      Point p =
          i == n ? home.p : center + Point{std::cos(t), std::sin(t)} * radius;
      double z = altitude * (up ? f : 1 - f);
      if (!g.clear(test.waypoints.back().position, p)) {
        safe = false;
        break;
      }
      double dt = distance(test.waypoints.back().position, p) / u.speed;
      append(test, p, z, u.speed, (!up && i == n) ? "landing" : "transit", dt);
    }
    if (safe) {
      a = std::move(test);
      return true;
    }
  }
  return false;
}
bool limits(const Assignment &a, Point home, const UavType &u,
            const Config &c) {
  if (a.distance * 1.02 > u.range + 1e-6 ||
      (c.maxFlightTime > 0 && a.duration * 1.02 > c.maxFlightTime))
    return false;
  for (auto &w : a.waypoints)
    if (distance(w.position, home) * 1.02 > u.homeRange + 1e-6 ||
        w.altitude > u.maxAlt + 1e-6)
      return false;
  return true;
}
bool finish(Flight &f, Pose home, const Vehicle &v, const UavType &u,
            const Geometry &g, const Config &config) {
  auto path = connection(f.pose, home, u, g);
  if (path.empty())
    return false;
  follow(f.assignment, path, v.altitude, u.speed);
  if (!vertical(f.assignment, home, v.altitude, false, u, g))
    return false;
  return limits(f.assignment, home.p, u, config);
}
struct Candidate {
  Assignment assignment;
  std::size_t count = 0;
};
Candidate makeFlight(std::size_t first, const std::vector<Track> &tracks,
                     const Vehicle &v, std::size_t sp, const PlanRequest &r,
                     const Geometry &g, double target, double homeHeading = 0) {
  const auto &u = r.types[r.uavs[v.index].type];
  Pose home{g.projection.forward(r.starts[sp].position), homeHeading};
  if (!g.free(home.p))
    return {};
  Flight active;
  active.assignment.uav = v.index;
  active.assignment.startPoint = sp;
  active.pose = home;
  append(active.assignment, home.p, 0, u.radius > 0 ? u.speed : 0, "takeoff",
         0);
  if (!vertical(active.assignment, home, v.altitude, true, u, g))
    return {};
  Candidate best;
  double surveyed = 0;
  for (std::size_t i = first; i < tracks.size(); ++i) {
    g.deadline.check();
    auto track = tracks[i];
    bool accepted = false;
    for (int direction = 0; direction < 2; ++direction) {
      if (direction)
        std::swap(track.a, track.b);
      Pose begin{track.a, heading(track.a, track.b)},
          end{track.b, begin.heading};
      auto transit = connection(active.pose, begin, u, g);
      if (transit.empty())
        continue;
      Flight next = active;
      follow(next.assignment, transit, v.altitude, u.speed);
      append(next.assignment, track.a, v.altitude, u.speed, "line_begin", 0,
             v.photo);
      append(next.assignment, track.b, v.altitude, u.speed, "line_end",
             distance(track.a, track.b) / u.speed);
      next.pose = end;
      Flight closed = next;
      if (!finish(closed, home, v, u, g, r.config))
        continue;
      best = {std::move(closed.assignment), i - first + 1};
      active = std::move(next);
      accepted = true;
      break;
    }
    if (!accepted)
      break;
    surveyed += distance(track.a, track.b);
    if (surveyed >= target || active.assignment.waypoints.size() > 30000)
      break;
  }
  return best;
}
struct Vec3 {
  double x, y, z;
};
Vec3 location(const Waypoint &a, const Waypoint &b, double absolute,
              double offset) {
  double duration = b.time - a.time;
  double f = duration > 1e-9
                 ? std::clamp((absolute - offset - a.time) / duration, 0., 1.)
                 : 0;
  return {a.position.x + (b.position.x - a.position.x) * f,
          a.position.y + (b.position.y - a.position.y) * f,
          a.altitude + (b.altitude - a.altitude) * f};
}
bool conflict(const Assignment &a, const Assignment &b, double separation) {
  if (a.landing + 1e-6 < b.takeoff || b.landing + 1e-6 < a.takeoff)
    return false;
  // Bounding boxes avoid quadratic work for disjoint operations.
  double ax = 1e100, ay = 1e100, bx = 1e100, by = 1e100, aX = -1e100,
         aY = -1e100, bX = -1e100, bY = -1e100;
  for (auto &w : a.waypoints) {
    ax = std::min(ax, w.position.x);
    ay = std::min(ay, w.position.y);
    aX = std::max(aX, w.position.x);
    aY = std::max(aY, w.position.y);
  }
  for (auto &w : b.waypoints) {
    bx = std::min(bx, w.position.x);
    by = std::min(by, w.position.y);
    bX = std::max(bX, w.position.x);
    bY = std::max(bY, w.position.y);
  }
  if (aX + separation < bx || bX + separation < ax || aY + separation < by ||
      bY + separation < ay)
    return false;
  std::size_t i = 1, j = 1;
  while (i < a.waypoints.size() && j < b.waypoints.size()) {
    auto &a0 = a.waypoints[i - 1];
    auto &a1 = a.waypoints[i];
    auto &b0 = b.waypoints[j - 1];
    auto &b1 = b.waypoints[j];
    double lo = std::max(a.takeoff + a0.time, b.takeoff + b0.time),
           hi = std::min(a.takeoff + a1.time, b.takeoff + b1.time);
    if (hi >= lo) {
      Vec3 p = location(a0, a1, lo, a.takeoff),
           q = location(b0, b1, lo, b.takeoff),
           p1 = location(a0, a1, hi, a.takeoff),
           q1 = location(b0, b1, hi, b.takeoff);
      Vec3 d{p.x - q.x, p.y - q.y, p.z - q.z},
          v{p1.x - q1.x - d.x, p1.y - q1.y - d.y, p1.z - q1.z - d.z};
      double vv = v.x * v.x + v.y * v.y + v.z * v.z,
             f = vv > 1e-15
                     ? std::clamp(-(d.x * v.x + d.y * v.y + d.z * v.z) / vv, 0.,
                                  1.)
                     : 0;
      double x = d.x + f * v.x, y = d.y + f * v.y, z = d.z + f * v.z;
      if (x * x + y * y + z * z < separation * separation)
        return true;
    }
    double ae = a.takeoff + a1.time, be = b.takeoff + b1.time;
    if (ae <= be)
      ++i;
    if (be <= ae)
      ++j;
  }
  return false;
}
void schedule(Assignment &a, const std::vector<Assignment> &existing,
              double earliest, double separation, const Deadline &deadline) {
  a.takeoff = earliest;
  a.landing = earliest + a.duration;
  bool changed = true;
  std::size_t attempts = 0;
  while (changed) {
    deadline.check();
    changed = false;
    for (auto &b : existing)
      if (conflict(a, b, separation * 1.03)) {
        a.takeoff = ++attempts <= 128 ? a.takeoff + 5 : b.landing + 1;
        a.landing = a.takeoff + a.duration;
        changed = true;
        break;
      }
  }
}
} // namespace
PlanResult Planner::plan(const PlanRequest &r) const {
  Geometry g(r);
  PlanResult out;
  out.warnings = r.warnings;
  out.warnings.push_back(
      "MVP model: flat terrain, constant cruise speed, 50% side/forward "
      "overlap; no wind, terrain or autopilot dynamics. WGS84 local metric "
      "approximation is limited to a 50 km envelope (+/-65 latitude).");
  out.warnings.push_back(
      "Exclusions include convex hulls of polygon zones and holes, buffered by "
      "configured clearance; circles are conservatively enlarged. Coverage is "
      "planned only outside these enlarged exclusions; full coverage of the "
      "originally requested area is not claimed.");
  out.warnings.push_back(
      "battery_usage is distance/max_flight_distance (%), not an "
      "electrochemical battery prediction. Range/home limits use 2% model "
      "margin. No per-UAV endurance is supplied by the API; only range and "
      "operation window apply unless PLANNER_MAX_FLIGHT_TIME_SECONDS is set.");
  out.warnings.push_back(
      "Separation uses time-parameterized 3D route segments; delays and "
      "tracking errors are not modeled. Turnaround is " +
      std::to_string(r.config.turnaround) + " seconds, separation is " +
      std::to_string(r.config.separation) + " m, exclusion clearance is " +
      std::to_string(r.config.clearance) + " m.");
  std::vector<Vehicle> vehicles;
  double spacing = 1e100;
  for (std::size_t i = 0; i < r.uavs.size(); ++i) {
    auto &uav = r.uavs[i];
    auto &u = r.types[uav.type];
    auto &c = r.cameras[uav.camera];
    std::string survey = c.type == "Multispectral" ? "multispectral" : c.type;
    if (survey != r.surveyType) {
      out.warnings.push_back("UAV " + uav.id +
                             " skipped: incompatible survey sensor.");
      continue;
    }
    // Both pixel axes must meet the requested maximum GSD.
    double altitude = std::min({r.gsd * .01 * c.focal * c.px / c.mx,
                                r.gsd * .01 * c.focal * c.py / c.my, u.maxAlt});
    if (altitude < u.minAlt || altitude <= 0) {
      out.warnings.push_back("UAV " + uav.id +
                             " skipped: GSD conflicts with minimum altitude.");
      continue;
    }
    double width = altitude * c.mx / c.focal,
           photo = altitude * c.my / c.focal * .5;
    spacing = std::min(spacing, width * .49);
    vehicles.push_back({i, altitude, width, photo});
  }
  if (vehicles.empty())
    throw std::runtime_error(
        "INFEASIBLE: no UAV satisfies survey type and GSD/altitude limits");
  auto tracks = g.tracks(spacing, r.config.maxTracks);
  double work = 0;
  for (auto t : tracks)
    work += distance(t.a, t.b);
  std::vector<double> available(r.uavs.size(), r.start);
  std::vector<std::size_t> homeForUav(r.uavs.size(), r.starts.size());
  std::size_t first = 0, totalPoints = 0;
  while (first < tracks.size()) {
    g.deadline.check();
    Candidate chosen;
    std::map<std::tuple<std::size_t, std::size_t, std::size_t>, Candidate>
        flightCache;
    double score = 1e100;
    for (auto &v : vehicles) {
      auto &u = r.types[r.uavs[v.index].type];
      double target = r.criterion == "min_time"
                          ? std::max(1000., work / double(vehicles.size()))
                          : u.range;
      target = std::min(target, u.range * .65);
      // The three closest usable supplied bases are deterministic heuristic
      // candidates.
      std::vector<std::pair<double, std::size_t>> bases;
      for (std::size_t s = 0; s < r.starts.size(); ++s) {
        if (homeForUav[v.index] < r.starts.size() && homeForUav[v.index] != s)
          continue;
        Point p = g.projection.forward(r.starts[s].position);
        if (g.free(p))
          bases.emplace_back(distance(p, tracks[first].a), s);
      }
      std::sort(bases.begin(), bases.end());
      for (std::size_t k = 0; k < std::min(std::size_t(3), bases.size()); ++k) {
        if (bases[k].first * 1.02 > u.homeRange)
          continue;
        auto key = std::make_tuple(r.uavs[v.index].type, r.uavs[v.index].camera,
                                   bases[k].second);
        Candidate cand;
        auto cached = flightCache.find(key);
        if (cached != flightCache.end()) {
          cand = cached->second;
        } else {
          cand = makeFlight(first, tracks, v, bases[k].second, r, g, target);
          if (!cand.count && u.radius > 0) {
            for (double angle : {pi / 2, pi, 3 * pi / 2}) {
              cand = makeFlight(first, tracks, v, bases[k].second, r, g, target,
                                angle);
              if (cand.count)
                break;
            }
          }
          flightCache.emplace(key, cand);
        }
        cand.assignment.uav = v.index;
        if (!cand.count)
          continue;
        schedule(cand.assignment, out.assignments, available[v.index],
                 r.config.separation, g.deadline);
        if (cand.assignment.landing > r.end)
          continue;
        double value =
            r.criterion == "min_time"
                ? (cand.assignment.landing - r.start) / double(cand.count)
                : cand.assignment.distance / double(cand.count);
        if (value < score - 1e-8) {
          score = value;
          chosen = std::move(cand);
        }
      }
    }
    if (!chosen.count)
      throw std::runtime_error(
          "INFEASIBLE: cannot safely assign survey segment " +
          std::to_string(first + 1) +
          " (range/home/turn geometry/base/operation window); heuristic may "
          "reject a feasible alternative");
    auto &a = chosen.assignment;
    available[a.uav] = a.landing + r.config.turnaround;
    homeForUav[a.uav] = a.startPoint;
    a.battery = 100 * a.distance / r.types[r.uavs[a.uav].type].range;
    totalPoints += a.waypoints.size();
    if (totalPoints > r.config.maxWaypoints)
      throw std::runtime_error("RESOURCE_LIMIT: too many output waypoints");
    out.distance += a.distance;
    out.assignments.push_back(std::move(a));
    first += chosen.count;
  }
  out.start = std::numeric_limits<double>::infinity();
  out.end = 0;
  std::set<std::size_t> used;
  // Validate the complete plan before converting to geographic coordinates.
  for (std::size_t i = 0; i < out.assignments.size(); ++i) {
    g.deadline.check();
    auto &a = out.assignments[i];
    auto &u = r.types[r.uavs[a.uav].type];
    Point home = g.projection.forward(r.starts[a.startPoint].position);
    if (!limits(a, home, u, r.config))
      throw std::runtime_error("INTERNAL_VALIDATION: flight limit");
    for (std::size_t k = 1; k < a.waypoints.size(); ++k)
      if (!g.clear(a.waypoints[k - 1].position, a.waypoints[k].position))
        throw std::runtime_error("INTERNAL_VALIDATION: obstacle intersection");
    for (std::size_t j = 0; j < i; ++j)
      if (conflict(a, out.assignments[j], r.config.separation))
        throw std::runtime_error("INTERNAL_VALIDATION: space-time collision");
    out.start = std::min(out.start, a.takeoff);
    out.end = std::max(out.end, a.landing);
    used.insert(a.uav);
  }
  out.used = used.size();




//----------------------------------------------------------------------новое
  std::set<std::string> touched;
  for (auto &a : out.assignments) {
    g.deadline.check();
    std::vector<Point> route;
    route.reserve(a.waypoints.size());
    for (auto &w : a.waypoints)
      route.push_back(w.position);
    for (auto &rz : r.restrictions) {
      if (touched.count(rz.id))
        continue;
      if (g.intersectsRestriction(rz, route))
        touched.insert(rz.id);
    }
  }
  out.restrictionWarnings.assign(touched.begin(), touched.end());



  for (auto &a : out.assignments)
    for (auto &w : a.waypoints) {
      w.position = g.projection.inverse(w.position);
      w.time += a.takeoff;
    }
  if (out.assignments.size() > out.used)
    out.warnings.push_back(
        "Repeated uav_id entries represent separate sorties. Existing frontend "
        "Mission Planner ZIP export overwrites same-UAV filenames; use the "
        "JSON response as the authoritative sortie schedule.");
  return out;
}
} // namespace planner
