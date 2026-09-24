#pragma once
#include "Models.hpp"
#include <nlohmann/json.hpp>
namespace planner {
class RequestParser {
public:
  PlanRequest parse(const nlohmann::json &) const;
};
std::string timestamp(double seconds);
} // namespace planner
