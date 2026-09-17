cmake_minimum_required(VERSION 3.15)
project(planner LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(planner SHARED planner.cpp)

target_include_directories(planner PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})