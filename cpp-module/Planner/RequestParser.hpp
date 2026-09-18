#pragma once

#include "Models.hpp"
#include <nlohmann/json_fwd.hpp>

namespace planner{

    class RequestParser
    {
    public:
        PlanRequest parse(const nlohmann::json& json) const;

    private:
        StartPoint parseStartPoint(
            const nlohmann::json& json) const;

        Uav parseUav(
            const nlohmann::json& json) const;
    };
}