# Vendored dependencies

The production build is offline and requires no downloads.

- nlohmann/json **3.11.3**, single header, MIT.
  Source: https://github.com/nlohmann/json/tree/v3.11.3
  Files: `nlohmann/json.hpp`, `nlohmann/LICENSE.MIT`.
- Andrew Walker, **Dubins-Curves**, MIT, source snapshot retrieved 2026-09-24.
  Source: https://github.com/AndrewWalker/Dubins-Curves
  Upstream files: `src/dubins.c`, `include/dubins.h`, `LICENSE.txt`.
  Files included here are unchanged. Content hashes are in `SHA256SUMS`.
  Used for bounded-turn-radius geometric connectors, not aircraft dynamics.

These dependencies are compiled into libplanner; the domain models and the
planning core do not depend on nlohmann/json. Only the boundary layer does.
