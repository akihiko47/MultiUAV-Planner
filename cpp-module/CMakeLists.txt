cmake_minimum_required(VERSION 3.15)

project(planner LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)


# Для корректной работы IntelliSense { 

include(FetchContent)

FetchContent_Declare(
    nlohmann_json
    URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz
)

FetchContent_MakeAvailable(nlohmann_json)
# }

# Solver libs

add_library(
    planner
    SHARED
    planner.cpp
)

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