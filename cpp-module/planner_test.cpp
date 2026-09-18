#include "planner.hpp"

#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

#ifndef TEST_DATA_DIR
#define TEST_DATA_DIR "."
#endif

int main()
{
    try
    {
        const std::string requestPath =
            std::string(TEST_DATA_DIR) + "/base_request.json";

        std::ifstream input(requestPath);

        if (!input.is_open())
        {
            throw std::runtime_error(
                "Cannot open test request: " + requestPath);
        }

        std::stringstream buffer;
        buffer << input.rdbuf();

        const std::string requestJson = buffer.str();

        char* response = plan_json(requestJson.c_str());

        if (response == nullptr)
        {
            throw std::runtime_error(
                "plan_json returned nullptr");
        }

        std::cout << "===== REQUEST =====\n";
        std::cout << requestJson << "\n\n";

        std::cout << "===== RESPONSE =====\n";
        std::cout << response << '\n';

        free_string(response);

        return 0;
    }
    catch (const std::exception& exception)
    {
        std::cerr
            << "TEST FAILED: "
            << exception.what()
            << '\n';

        return 1;
    }
}