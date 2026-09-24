#include "planner.hpp"
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
int main(int argc, char **argv) {
  std::ostringstream in;
  if (argc == 2) {
    std::ifstream file(argv[1]);
    if (!file) {
      std::cerr << "Cannot read request\n";
      return 2;
    }
    in << file.rdbuf();
  } else if (argc == 1)
    in << std::cin.rdbuf();
  else {
    std::cerr << "Usage: planner_test [request.json]\n";
    return 2;
  }
  char *result = plan_json(in.str().c_str());
  if (!result) {
    std::cerr << "Allocation failure\n";
    return 3;
  }
  std::string out(result);
  free_string(result);
  std::cout << out << '\n';
  return out.find("\"error\":") != std::string::npos ? 1 : 0;
}
