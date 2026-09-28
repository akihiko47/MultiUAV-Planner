#include "Geometry.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
#include <queue>
#include <stdexcept>
namespace planner {
Point operator+(Point a, Point b) { return {a.x + b.x, a.y + b.y}; }
Point operator-(Point a, Point b) { return {a.x - b.x, a.y - b.y}; }
Point operator*(Point a, double s) { return {a.x * s, a.y * s}; }
double dot(Point a, Point b) { return a.x * b.x + a.y * b.y; }
double cross(Point a, Point b) { return a.x * b.y - a.y * b.x; }
double norm(Point a) { return std::hypot(a.x, a.y); }
double distance(Point a, Point b) { return norm(a - b); }
Deadline::Deadline(double seconds)
    : end(std::chrono::steady_clock::now() +
          std::chrono::milliseconds(static_cast<long long>(seconds * 1000))) {}
void Deadline::check() const {
  if (std::chrono::steady_clock::now() > end)
    throw std::runtime_error("RESOURCE_LIMIT: planning deadline exceeded");
}
Projection::Projection(Point p) : origin(p) {
  double lat = p.y * pi / 180, e2 = 0.0066943799901413165,
         w = std::sqrt(1 - e2 * std::sin(lat) * std::sin(lat));
  sx = 6378137 / w * std::cos(lat) * pi / 180;
  sy = 6378137 * (1 - e2) / (w * w * w) * pi / 180;
  if (std::abs(p.y) > 65)
    throw std::invalid_argument(
        "UNSUPPORTED_GEOGRAPHY: latitude must be within +/-65 degrees");
}
Point Projection::forward(Point p) const {
  return {(p.x - origin.x) * sx, (p.y - origin.y) * sy};
}
Point Projection::inverse(Point p) const {
  return {p.x / sx + origin.x, p.y / sy + origin.y};
}
namespace {
constexpr double eps = 1e-7;
Ring hull(Ring p) {
  std::sort(p.begin(), p.end(), [](Point a, Point b) {
    return a.x < b.x || (a.x == b.x && a.y < b.y);
  });
  p.erase(std::unique(p.begin(), p.end(),
                      [](Point a, Point b) { return distance(a, b) < eps; }),
          p.end());
  if (p.size() < 3)
    throw std::invalid_argument("INVALID_GEOMETRY: degenerate polygon");
  Ring h(2 * p.size());
  std::size_t k = 0;
  for (auto a : p) {
    while (k >= 2 && cross(h[k - 1] - h[k - 2], a - h[k - 1]) <= eps)
      --k;
    h[k++] = a;
  }
  for (std::size_t i = p.size() - 1, t = k + 1; i > 0; --i) {
    Point a = p[i - 1];
    while (k >= t && cross(h[k - 1] - h[k - 2], a - h[k - 1]) <= eps)
      --k;
    h[k++] = a;
  }
  h.resize(k - 1);
  return h;
}
Ring inflate(const Ring &h, double d) {
  Ring r;
  for (std::size_t i = 0; i < h.size(); ++i) {
    Point a = h[(i + h.size() - 1) % h.size()], b = h[i],
          c = h[(i + 1) % h.size()];
    Point e = b - a, f = c - b;
    e = e * (1 / norm(e));
    f = f * (1 / norm(f));
    Point n{e.y, -e.x}, m{f.y, -f.x};
    double det = cross(e, f);
    if (std::abs(det) < eps) {
      r.push_back(b + n * d);
      continue;
    }
    Point p = b + n * d, q = b + m * d;
    r.push_back(p + e * (cross(q - p, f) / det));
  }
  return r;
}
Obstacle obstacle(Ring v) {
  Obstacle o{std::move(v), 1e100, 1e100, -1e100, -1e100};
  for (auto p : o.vertices) {
    o.minx = std::min(o.minx, p.x);
    o.maxx = std::max(o.maxx, p.x);
    o.miny = std::min(o.miny, p.y);
    o.maxy = std::max(o.maxy, p.y);
  }
  return o;
}
bool interior(Point p, const Ring &r) {
  for (std::size_t i = 0; i < r.size(); ++i) {
    Point a = r[i], b = r[(i + 1) % r.size()];
    if (cross(b - a, p - a) <= eps * norm(b - a))
      return false;
  }
  return true;
}
bool blocked(Point a, Point b, const Obstacle &o) {
  if (std::max(a.x, b.x) < o.minx || std::min(a.x, b.x) > o.maxx ||
      std::max(a.y, b.y) < o.miny || std::min(a.y, b.y) > o.maxy)
    return false;
  double lo = 0, hi = 1;
  Point v = b - a;
  for (std::size_t i = 0; i < o.vertices.size(); ++i) {
    Point p = o.vertices[i], e = o.vertices[(i + 1) % o.vertices.size()] - p;
    double c = cross(e, a - p) - eps * norm(e), d = cross(e, v);
    if (std::abs(d) < 1e-12) {
      if (c <= 0)
        return false;
    } else if (d > 0)
      lo = std::max(lo, -c / d);
    else
      hi = std::min(hi, -c / d);
    if (lo >= hi)
      return false;
  }
  return lo < hi && hi > 0 && lo < 1;
}
bool onSegment(Point a, Point b, Point p) {
  return std::abs(cross(b - a, p - a)) <= eps * std::max(1., norm(b - a)) &&
         dot(p - a, p - b) <= eps;
}
bool intersect(Point a, Point b, Point c, Point d) {
  double a1 = cross(b - a, c - a), a2 = cross(b - a, d - a),
         a3 = cross(d - c, a - c), a4 = cross(d - c, b - c);
  if (((a1 > 0 && a2 < 0) || (a1 < 0 && a2 > 0)) &&
      ((a3 > 0 && a4 < 0) || (a3 < 0 && a4 > 0)))
    return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) ||
         onSegment(c, d, b);
}
bool inRing(Point p, const Ring &r) {
  bool in = false;
  for (std::size_t i = 0, j = r.size() - 1; i < r.size(); j = i++) {
    auto a = r[i], b = r[j];
    if (onSegment(a, b, p))
      return true;
    if ((a.y > p.y) != (b.y > p.y) &&
        p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)
      in = !in;
  }
  return in;
}
void validRing(Ring &r, const Deadline &deadline) {
  if (distance(r.front(), r.back()) < eps)
    r.pop_back();
  if (r.size() < 3)
    throw std::invalid_argument("INVALID_GEOMETRY: degenerate ring");
  double area = 0;
  for (std::size_t i = 0; i < r.size(); ++i) {
    deadline.check();
    auto a = r[i], b = r[(i + 1) % r.size()];
    if (distance(a, b) < .001)
      throw std::invalid_argument("INVALID_GEOMETRY: repeated ring vertices");
    area += cross(a, b);
    for (std::size_t j = i + 1; j < r.size(); ++j) {
      if (j == i + 1 || (i == 0 && j == r.size() - 1))
        continue;
      if (intersect(a, b, r[j], r[(j + 1) % r.size()]))
        throw std::invalid_argument("INVALID_GEOMETRY: self intersection");
    }
  }
  if (std::abs(area) < .01)
    throw std::invalid_argument("INVALID_GEOMETRY: zero area");
}
bool ringsIntersect(const Ring &a, const Ring &b) {
  for (std::size_t i = 0; i < a.size(); ++i)
    for (std::size_t j = 0; j < b.size(); ++j)
      if (intersect(a[i], a[(i + 1) % a.size()], b[j], b[(j + 1) % b.size()]))
        return true;
  return false;
}
using Interval = std::pair<double, double>;
std::vector<Interval> scan(const Ring &r, double y, bool swap) {
  std::vector<double> x;
  for (std::size_t i = 0; i < r.size(); ++i) {
    Point a = r[i], b = r[(i + 1) % r.size()];
    if (swap) {
      std::swap(a.x, a.y);
      std::swap(b.x, b.y);
    }
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y))
      x.push_back(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
  }
  std::sort(x.begin(), x.end());
  std::vector<Interval> v;
  for (std::size_t i = 0; i + 1 < x.size(); i += 2)
    if (x[i + 1] - x[i] > .001)
      v.emplace_back(x[i], x[i + 1]);
  return v;
}
std::vector<Interval> subtract(std::vector<Interval> a,
                               const std::vector<Interval> &b) {
  for (auto cut : b) {
    std::vector<Interval> out;
    for (auto p : a) {
      if (cut.second <= p.first || cut.first >= p.second)
        out.push_back(p);
      else {
        if (cut.first > p.first)
          out.emplace_back(p.first, cut.first);
        if (cut.second < p.second)
          out.emplace_back(cut.second, p.second);
      }
    }
    a = std::move(out);
  }
  return a;
}
} // namespace
Geometry::Geometry(const PlanRequest &r)
    : projection(r.area.front().front().front()),
      deadline(r.config.calculationSeconds) {
  double minx = 0, miny = 0, maxx = 0, maxy = 0;
  auto include = [&](Point p) {
    if (norm(p) > 50000)
      throw std::invalid_argument("UNSUPPORTED_GEOGRAPHY: survey and starts "
                                  "must lie within 50 km of first vertex");
    minx = std::min(minx, p.x);
    maxx = std::max(maxx, p.x);
    miny = std::min(miny, p.y);
    maxy = std::max(maxy, p.y);
  };
  for (auto p : r.area) {
    for (auto &ring : p) {
      for (auto &pt : ring) {
        pt = projection.forward(pt);
        include(pt);
      }
      validRing(ring, deadline);
    }
    for (std::size_t i = 1; i < p.size(); ++i) {
      if (!inRing(p[i][0], p[0]) || ringsIntersect(p[0], p[i]))
        throw std::invalid_argument(
            "INVALID_GEOMETRY: hole outside/touching shell");
      for (std::size_t j = 1; j < i; ++j)
        if (ringsIntersect(p[i], p[j]) || inRing(p[i][0], p[j]) ||
            inRing(p[j][0], p[i]))
          throw std::invalid_argument("INVALID_GEOMETRY: overlapping holes");
    }
    area.push_back(std::move(p));
  }
  for (std::size_t i = 0; i < area.size(); ++i)
    for (std::size_t j = 0; j < i; ++j)
      if (ringsIntersect(area[i][0], area[j][0]) ||
          inRing(area[i][0][0], area[j][0]) ||
          inRing(area[j][0][0], area[i][0]))
        throw std::invalid_argument(
            "INVALID_GEOMETRY: overlapping/nested MultiPolygon components");
  for (auto s : r.starts)
    include(projection.forward(s.position));
  // Include every obstacle whose conservative hull intersects the routing
  // envelope.
  double pad = 10000;
  minx -= pad;
  maxx += pad;
  miny -= pad;
  maxy += pad;
  minx_ = minx;
  maxx_ = maxx;
  miny_ = miny;
  maxy_ = maxy;
  auto projectZone = [&](Point p) {
    p.x = projection.origin.x + std::remainder(p.x - projection.origin.x, 360.);
    return projection.forward(p);
  };
  for (auto &z : r.zones) {
    deadline.check();
    Ring v;
    if (z.radius > 0) {
      Point c = projectZone(z.center);
      // A bound on the projection differential across the entire geodesic
      // disk (6330 km is below both WGS84 principal curvature radii).
      double latitudeBound =
          std::min(89.9, std::abs(z.center.y) + z.radius / 6330000 * 180 / pi);
      double scale =
          std::max({1.03,
                    projection.sx * 180 / pi /
                        (6330000 * std::cos(latitudeBound * pi / 180)),
                    projection.sy * 180 / pi / 6330000});
      double radius = z.radius * scale + r.config.clearance;
      if (c.x + radius < minx || c.x - radius > maxx || c.y + radius < miny ||
          c.y - radius > maxy)
        continue;
      radius /= std::cos(pi / 48);
      for (int i = 0; i < 48; ++i)
        v.push_back(
            c + Point{std::cos(2 * pi * i / 48), std::sin(2 * pi * i / 48)} *
                    radius);
    } else {
      for (auto p : z.ring)
        v.push_back(projectZone(p));
      auto o = obstacle(v);
      if (o.maxx + r.config.clearance < minx ||
          o.minx - r.config.clearance > maxx ||
          o.maxy + r.config.clearance < miny ||
          o.miny - r.config.clearance > maxy)
        continue;
      v = inflate(hull(v), r.config.clearance * 1.03);
    }
    obstacles.push_back(obstacle(std::move(v)));
  }
  // Holes are conservative no-transit exclusions too; never fill them with
  // photography.
  for (auto &p : area)
    for (std::size_t i = 1; i < p.size(); ++i)
      obstacles.push_back(
          obstacle(inflate(hull(p[i]), r.config.clearance * 1.03)));
}
bool Geometry::clear(Point a, Point b) const {
  auto inside = [&](Point p) {
    return norm(p) <= 50000 && std::abs(projection.inverse(p).y) <= 65 &&
           p.x >= minx_ && p.x <= maxx_ && p.y >= miny_ && p.y <= maxy_;
  };
  if (!inside(a) || !inside(b))
    return false;
  for (auto &o : obstacles)
    if (blocked(a, b, o))
      return false;
  return true;
}
bool Geometry::free(Point p) const {
  if (norm(p) > 50000 || std::abs(projection.inverse(p).y) > 65 ||
      p.x < minx_ || p.x > maxx_ || p.y < miny_ || p.y > maxy_)
    return false;
  for (auto &o : obstacles)
    if (p.x >= o.minx && p.x <= o.maxx && p.y >= o.miny && p.y <= o.maxy &&
        interior(p, o.vertices))
      return false;
  return true;
}
std::vector<Point> Geometry::route(Point a, Point b, double extra) const {
  deadline.check();
  if (!free(a) || !free(b))
    return {};
  if (clear(a, b))
    return {a, b};
  std::vector<Point> nodes{a, b};
  double limit = distance(a, b) * 2 + 5000 + extra * 10;
  for (auto &o : obstacles) {
    if (o.minx > std::max(a.x, b.x) + limit ||
        o.maxx < std::min(a.x, b.x) - limit ||
        o.miny > std::max(a.y, b.y) + limit ||
        o.maxy < std::min(a.y, b.y) - limit)
      continue;
    auto v = extra > 0 ? inflate(o.vertices, extra) : o.vertices;
    for (auto p : v)
      if (free(p))
        nodes.push_back(p);
  }
  if (nodes.size() > 3000)
    throw std::runtime_error(
        "RESOURCE_LIMIT: visibility graph exceeds 3000 vertices");
  std::vector<double> d(nodes.size(), 1e100);
  std::vector<int> prev(nodes.size(), -1);
  std::vector<bool> done(nodes.size());
  using Item = std::pair<double, std::size_t>;
  std::priority_queue<Item, std::vector<Item>, std::greater<Item>> q;
  d[0] = 0;
  q.emplace(distance(a, b), 0);
  while (!q.empty()) {
    deadline.check();
    auto i = q.top().second;
    q.pop();
    if (done[i])
      continue;
    done[i] = true;
    if (i == 1)
      break;
    for (std::size_t j = 1; j < nodes.size(); ++j) {
      if (done[j])
        continue;
      double nd = d[i] + distance(nodes[i], nodes[j]);
      if (nd < d[j] && clear(nodes[i], nodes[j])) {
        d[j] = nd;
        prev[j] = int(i);
        q.emplace(nd + distance(nodes[j], b), j);
      }
    }
  }
  if (prev[1] < 0)
    return {};
  std::vector<Point> path;
  for (int i = 1; i >= 0; i = prev[std::size_t(i)])
    path.push_back(nodes[std::size_t(i)]);
  std::reverse(path.begin(), path.end());
  return path;
}
std::vector<Track> Geometry::tracks(double spacing, std::size_t limit) const {
  std::vector<Track> result;
  std::size_t row = 0;
  for (auto &p : area) {
    double xlo = 1e100, xhi = -1e100, ylo = 1e100, yhi = -1e100;
    for (auto v : p[0]) {
      xlo = std::min(xlo, v.x);
      xhi = std::max(xhi, v.x);
      ylo = std::min(ylo, v.y);
      yhi = std::max(yhi, v.y);
    }
    bool swap = (xhi - xlo) < (yhi - ylo);
    if (swap) {
      std::swap(xlo, ylo);
      std::swap(xhi, yhi);
    }
    double count = std::ceil((yhi - ylo) / spacing);
    if (count > double(limit))
      throw std::runtime_error("RESOURCE_LIMIT: too many survey lanes");
    std::size_t n = std::max(std::size_t(1), std::size_t(count));
    double dy = (yhi - ylo) / double(n);
    for (std::size_t k = 0; k < n; ++k, ++row) {
      deadline.check();
      double y = ylo + (double(k) + .5) * dy;
      auto intervals = scan(p[0], y, swap);
      for (std::size_t i = 1; i < p.size(); ++i)
        intervals = subtract(intervals, scan(p[i], y, swap));
      for (auto &o : obstacles)
        intervals = subtract(intervals, scan(o.vertices, y, swap));
      std::vector<Track> lane;
      for (auto seg : intervals) {
        if (seg.second - seg.first < .1)
          continue;
        seg.first += .02;
        seg.second -= .02;
        std::size_t chunks =
            std::max(std::size_t(1),
                     std::size_t(std::ceil((seg.second - seg.first) / 1000)));
        for (std::size_t c = 0; c < chunks; ++c) {
          Point a{seg.first +
                      (seg.second - seg.first) * double(c) / double(chunks),
                  y},
              b{seg.first +
                    (seg.second - seg.first) * double(c + 1) / double(chunks),
                y};
          if (swap) {
            std::swap(a.x, a.y);
            std::swap(b.x, b.y);
          }
          lane.push_back({a, b});
        }
      }
      if (row % 2) {
        std::reverse(lane.begin(), lane.end());
        for (auto &t : lane)
          std::swap(t.a, t.b);
      }
      for (auto &t : lane) {
        if (!clear(t.a, t.b))
          throw std::runtime_error(
              "INTERNAL_VALIDATION: survey track intersects exclusion");
        result.push_back(t);
      }
      if (result.size() > limit)
        throw std::runtime_error("RESOURCE_LIMIT: too many survey segments");
    }
  }
  if (result.empty())
    throw std::runtime_error(
        "INFEASIBLE: no surveyable area remains outside exclusions");
  return result;
}




//-------------------------------------------------------------новое
bool Geometry::intersectsRestriction(
    const RestrictionZone &z, const std::vector<Point> &route) const {
  if (route.size() < 2)
    return false;

  deadline.check();

  double rxmin = route[0].x, rxmax = route[0].x;
  double rymin = route[0].y, rymax = route[0].y;
  for (auto &p : route) {
    rxmin = std::min(rxmin, p.x);
    rxmax = std::max(rxmax, p.x);
    rymin = std::min(rymin, p.y);
    rymax = std::max(rymax, p.y);
  }

  Ring zoneRing;
  double zxmin = 1e100, zxmax = -1e100, zymin = 1e100, zymax = -1e100;
  auto push = [&](Point p) {
    zoneRing.push_back(p);
    zxmin = std::min(zxmin, p.x);
    zxmax = std::max(zxmax, p.x);
    zymin = std::min(zymin, p.y);
    zymax = std::max(zymax, p.y);
  };

  if (z.radius > 0) {
    Point c = projection.forward(z.center);
    double r = z.radius;
    for (int i = 0; i < 64; ++i)
      push(c + Point{std::cos(2 * pi * i / 64),
                     std::sin(2 * pi * i / 64)} * r);
  } else if (z.semiMajor > 0 && z.semiMinor > 0) {
    Point c = projection.forward(z.center);
    double a = z.semiMajor, b = z.semiMinor;
    double az = z.azimuthDeg * pi / 180.0;
    double ca = std::cos(az), sa = std::sin(az);
    for (int i = 0; i < 128; ++i) {
      double t = 2 * pi * i / 128;
      double x = a * std::cos(t), y = b * std::sin(t);
      push(c + Point{x * ca - y * sa, x * sa + y * ca});
    }
  } else {
    for (auto &p : z.ring)
      push(projection.forward(p));
  }
  if (zoneRing.size() < 3)
    return false;

  if (zxmax < rxmin || zxmin > rxmax || zymax < rymin || zymin > rymax)
    return false;

  // 4) Полная проверка: рёбра зоны × сегменты маршрута.
  for (std::size_t i = 0; i < zoneRing.size(); ++i) {
    Point a = zoneRing[i];
    Point b = zoneRing[(i + 1) % zoneRing.size()];
    for (std::size_t j = 1; j < route.size(); ++j) {
      deadline.check();   // ← периодически проверяем
      if (intersect(a, b, route[j - 1], route[j]))
        return true;
    }
  }
  for (auto &p : route)
    if (inRing(p, zoneRing))
      return true;

  return false;
}
} // namespace planner
