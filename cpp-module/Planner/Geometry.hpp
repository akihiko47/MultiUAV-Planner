#pragma once
#include "Models.hpp"
#include <chrono>
#include <utility>
namespace planner {
constexpr double pi = 3.14159265358979323846;
Point operator+(Point a, Point b);
Point operator-(Point a, Point b);
Point operator*(Point a, double s);
double dot(Point a, Point b);
double cross(Point a, Point b);
double norm(Point a);
double distance(Point a, Point b);
struct Deadline {
  std::chrono::steady_clock::time_point end;
  explicit Deadline(double seconds);
  void check() const;
};
struct Projection {
  Point origin;
  double sx, sy;
  explicit Projection(Point origin);
  Point forward(Point p) const;
  Point inverse(Point p) const;
};
struct Obstacle {
  Ring vertices;
  double minx, miny, maxx, maxy;
};
struct Track {
  Point a, b;
};
class Geometry {
public:
  Projection projection;
  std::vector<Polygon> area;
  std::vector<Obstacle> obstacles;
  Deadline deadline;
  Geometry(const PlanRequest &r);
  bool clear(Point a, Point b) const;
  bool free(Point p) const;
  std::vector<Point> route(Point a, Point b, double extra = 0) const;
  std::vector<Track> tracks(double spacing, std::size_t limit) const;

private:
  double minx_ = 0, miny_ = 0, maxx_ = 0, maxy_ = 0;
};
} // namespace planner
