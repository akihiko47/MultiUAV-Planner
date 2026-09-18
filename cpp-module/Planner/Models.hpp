#pragma once

#pragma once

#include <string>
#include <vector>

namespace planner
{

    struct GeoPoint
    {
        double longitude = 0.0;
        double latitude = 0.0;
    };

    struct StartPoint
    {
        std::string id;
        GeoPoint position;
    };

    struct Uav
    {
        std::string id;
        std::string typeId;
    };

    struct PlanRequest
    {
        std::string surveyType;
        std::string optimizationCriteria;

        std::vector<StartPoint> startPoints;
        std::vector<Uav> uavs;

        std::string operationStart;  // ISO 8601
        std::string operationEnd;    // ISO 8601
    };

    struct PlanSummary
    {
        std::string optimizationCriteria;

        double totalTime = 0.0;
        double totalDistance = 0.0;

        std::size_t uavsUsed = 0;
        std::size_t uavsTotal = 0;

        std::string operationStart;  // ISO 8601
        std::string operationEnd;    // ISO 8601
    };

    struct PlanResult
    {
        PlanSummary summary;
        std::vector<std::string> warnings;
    };

}