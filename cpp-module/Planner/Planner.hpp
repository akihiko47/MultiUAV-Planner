#pragma once

#include "Models.hpp"

namespace planner {
    class Planner
    {
    public:
        PlanResult plan(const PlanRequest& request) const;
    };
} 