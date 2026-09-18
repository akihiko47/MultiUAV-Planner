cmake_minimum_required(VERSION 3.15)

project(planner LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)


# -------------------------------
# Dependencies
# -------------------------------

include(FetchContent)

FetchContent_Declare(
    nlohmann_json
    URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz
)

FetchContent_MakeAvailable(nlohmann_json)


# -------------------------------
# Planner shared library
# -------------------------------

add_library(
    planner
    SHARED
    planner.cpp
 "Planner/Planner.hpp" "Planner/Planner.cpp" "Planner/RequestParser.cpp")

target_include_directories(
    planner
    PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(
    planner
    PRIVATE
    nlohmann_json::nlohmann_json
)


# -------------------------------
# Local test runner
# -------------------------------

add_executable(
    planner_test
    planner_test.cpp
    planner.cpp
 "Planner/Planner.hpp" "Planner/Planner.cpp" "Planner/RequestParser.cpp")

target_include_directories(
    planner_test
    PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(
    planner_test
    PRIVATE
    nlohmann_json::nlohmann_json
)

target_compile_definitions(
    planner_test
    PRIVATE
    TEST_DATA_DIR="${CMAKE_CURRENT_SOURCE_DIR}/test-data"
)
