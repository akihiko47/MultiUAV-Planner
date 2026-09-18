#include "planner.hpp"

//std
#include <string>
#include <cstdlib>
#include <cstring>
#include <stdexcept>

//json lib
#include <nlohmann/json.hpp>

using json = nlohmann::json;

std::string compute_plan(const std::string& request_json) {
    // 1. Распарсить request_json, например через nlohmann/json.
    // 2. Посчитать маршруты.
    // 3. Собрать ответ по формату README.

    //Измения****

    json j;

    // Заглушка:
    return R"({
      "summary": {
        "optimization_criteria": "min_time",
        "total_time": 0,
        "total_distance": 0,
        "uavs_used": 0,
        "uavs_total": 0,
        "operation_start": "2026-04-15T08:00:00Z",
        "operation_end": "2026-04-15T08:00:00Z"
      },
      "uav_assignments": [],
      "warnings": []
    })";
}

extern "C" {

char* plan_json(const char* request_json) {
    try {
        std::string req = request_json ? request_json : "";
        std::string result = compute_plan(req);

        char* out = static_cast<char*>(std::malloc(result.size() + 1));
        if (!out) throw std::bad_alloc();

        std::memcpy(out, result.c_str(), result.size() + 1);
        return out;
    } catch (const std::exception& e) {
        std::string err = std::string("{\"error\":\"") + e.what() + "\"}";
        char* out = static_cast<char*>(std::malloc(err.size() + 1));
        if (out) std::memcpy(out, err.c_str(), err.size() + 1);
        return out;
    }
}

void free_string(char* p) {
    std::free(p);
}

} // extern "C"