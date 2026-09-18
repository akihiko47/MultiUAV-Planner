#include "RequestParser.hpp"

#include <nlohmann/json.hpp>

#include <stdexcept>

namespace planner{

    PlanRequest RequestParser::parse(const nlohmann::json& json) const {
        
        PlanRequest request;

        request.surveyType = json.at("survey_type").get<std::string>();

        request.optimizationCriteria = json.at("optimization_criteria").get<std::string>();

        for (const auto& startPointJson : json.at("start_points")){
            request.startPoints.push_back(parseStartPoint(startPointJson));
        }

        for (const auto& uavJson : json.at("uavs")){
            request.uavs.push_back(parseUav(uavJson));
        }

        return request;
    }


    StartPoint RequestParser::parseStartPoint(const nlohmann::json& json) const {
        
        StartPoint result;

        result.id = json.at("id").get<std::string>();

        const auto& coordinates = json.at("coordinates");

        if (!coordinates.is_array() || coordinates.size() != 2) {
            throw std::invalid_argument(
                "Start point coordinates must contain "
                "[longitude, latitude]");
        }

        result.position.longitude = coordinates.at(0).get<double>();

        result.position.latitude = coordinates.at(1).get<double>();

        return result;
    }


    Uav RequestParser::parseUav(const nlohmann::json& json) const {
        
        Uav result;

        result.id = json.at("id").get<std::string>();

        result.typeId = json.at("type_id").get<std::string>();

        return result;
    }

} 