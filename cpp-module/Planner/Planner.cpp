#include "Planner.hpp"

namespace planner{

    PlanResult Planner::plan(const PlanRequest& request) const{

        PlanResult result;

        result.summary.optimizationCriteria = request.optimizationCriteria;

        result.summary.uavsTotal = request.uavs.size();

        return result;
    }

} 