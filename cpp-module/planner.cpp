#include "planner.hpp"

//planner
#include "Planner/Planner.hpp"
#include "Planner/RequestParser.hpp"

//std
#include <cstdlib>
#include <cstring>
#include <new>
#include <string>

//json
#include <nlohmann/json.hpp>

namespace{

    using Json = nlohmann::json;

    char* allocateCString(const std::string& value) {

        char* buffer = static_cast<char*>(std::malloc(value.size() + 1));

        if (buffer == nullptr){
            throw std::bad_alloc();
        }

        std::memcpy(buffer, value.c_str(), value.size() + 1);

        return buffer;
    }

    Json serializeResult(const planner::PlanResult& result) {
        return Json({
                    {
                        "summary",
                        {
                            {
                                "optimization_criteria",
                                result.summary.optimizationCriteria
                            },
                            {
                                "total_time",
                                result.summary.totalTime
                            },
                            {
                                "total_distance",
                                result.summary.totalDistance
                            },
                            {
                                "uavs_used",
                                result.summary.uavsUsed
                            },
                            {
                                "uavs_total",
                                result.summary.uavsTotal
                            },
                            {
                                "operation_start",
                                result.summary.operationStart
                            },
                            {
                                "operation_end",
                                result.summary.operationEnd
                            }
                        }
                    },
                    {
                        "uav_assignments",
                        Json::array()
                    },
                    {
                        "warnings",
                        result.warnings
                    }
                });
    }

    std::string makeErrorResponse(const std::string& message){
        const Json response = {
            {"error", message}
        };

        return response.dump();
    }
}


std::string compute_plan(const std::string& requestJson){
    
    const Json jsonRequest = Json::parse(requestJson);

    const planner::RequestParser parser;

    const planner::PlanRequest request = parser.parse(jsonRequest);

    const planner::Planner planner;

    const planner::PlanResult result = planner.plan(request);

    return serializeResult(result).dump();
}


extern "C"{

    char* plan_json(const char* requestJson){

        try{
            if (requestJson == nullptr){
                throw std::invalid_argument(
                    "request_json must not be null, dude");
            }

            const std::string result = compute_plan(requestJson);

            return allocateCString(result);
        }
        catch (const std::exception& exception){
            try{
                return allocateCString(makeErrorResponse(exception.what()));
            }
            catch (...){
                return nullptr;
            }
        }
        catch (...){
            try{
                return allocateCString(makeErrorResponse("Unknown planner error, dude"));
            }
            catch (...){
                return nullptr;
            }
        }
    }


    void free_string(char* pointer){
        std::free(pointer);
    }

} // extern "C"