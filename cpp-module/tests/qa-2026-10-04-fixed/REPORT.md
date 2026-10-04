# Исправления и повторная проверка — 4 октября 2026

Все шесть проблем предыдущего отчёта исправлены. Контейнеры nginx/frontend и FastAPI/C++ пересобраны и запущены на http://localhost:8080.

| Проверка | Результат |
|---|---|
| Frontend unit tests | 11/11 PASS |
| Backend regression tests | 4/4 PASS, включая подслучаи кодов ошибок |
| Штатный CTest | 2/2 PASS, smoke + regression |
| Независимая C ABI регрессия | 54/54 PASS, без пропущенных проверок |
| HTTP через настоящий Docker stack | 56/56 PASS |
| Независимая геометрия HTTP-ответов | 8/8 PASS |
| ASan + UBSan | 47 сценариев + 10 некорректных/крайних входов PASS |
| Docker production build | PASS |
| git diff --check | PASS |

## Что изменилось

- Mission Planner ZIP: одному БВС с несколькими вылетами назначаются имена `uav3_sortie_1.waypoints`, `uav3_sortie_2.waypoints` и т. д. Одиночные вылеты сохраняют прежние имена. Коллизии с реальными идентификаторами разрешаются дополнительным суффиксом; разделители каталогов кодируются. Проверены настоящий план с 6 вылетами, коллизия суффикса и идентификатор `../folder/uav`. Для каждой записи сверено количество навигационных waypoint.
- KML: XML-текст экранируется, CDATA корректно разделяется при `]]>`, Style id генерируется из индекса вылета. Повторные вылеты получают разные Style id, ссылки на стили валидны. Проверены символы `<`, `&`, кавычки в идентификаторах и `]]>` в камере; XML парсится, исходные названия восстанавливаются.
- Native diagnostics: введён отдельный `PlannerError`. `INVALID_REQUEST`, `INVALID_GEOMETRY`, `UNSUPPORTED_GEOGRAPHY`, `INFEASIBLE`, `RESOURCE_LIMIT` возвращают HTTP 422 с прежним подробным `detail`. Внутренние ошибки и сбои загрузки/вызова остаются 500, неверный PlanResponse — 502; это покрыто backend regression tests.
- C++ graph: граф начинается с препятствий около отрезка, затем область поиска удваивается до прежней границы, если маршрут не найден. **Все рёбра проверяются против полного списка препятствий**, лимит 3000 вершин и deadline сохранены. Теперь `base_request.json` с GSD=3 строит валидный маршрут: 1 вылет, 71 waypoint, 7869.35 м; около 0.13 с на расчёт и 0.59 с вместе с независимой валидацией.
- Compact panel: нативный обработчик Escape не закрывает панель, когда событие пришло из поля переименования. React успевает отменить изменение. В браузере проверены 1000×800 и 390×844: имя возвращается к `uav1`, панель остаётся открытой; Enter сохраняет имя; Escape вне поля по-прежнему закрывает панель.
- Nginx: добавлены `/v1/` и `/health`, существующий `/api/` сохранён. URL из README и Swagger работает напрямую. Документация API дополнена кодами ошибок и совместимыми путями.

## Исправления тестовой инфраструктуры

Validator учитывает фактическое наличие GSD в обновлённом `regular.json`. Контроль неизменности теперь сравнивает исходники до и после текущего прогона, а не с хэшами старой версии проекта. CTest сохраняет generated JSON и отчёт в каталоге сборки, оставляя исторические доказательства нетронутыми. Проверки геометрии, NFZ, времени, разделения БВС, дальности и GSD не ослаблены.

Полный набор: `acceptance.json`, `http.json`, `http_geometry.json`, `sanitizers.json`. Логи лежат уровнем выше с префиксом `qa-fixed-`. Снимки исправленного UI: `escape-fixed.jpg`, `mobile-escape-fixed.jpg`.

## Воспроизведение

HTTP и frontend из корня проекта:

```powershell
docker compose up -d --build
node --test frontend/src/utils/*.test.mjs
$env:QA_OUTPUT='E:\DateGaza\MultiUAV-Planner\cpp-module\tests\qa-2026-10-04-fixed'
python cpp-module/tests/qa_http.py
```

В Linux/WSL с установленными `cpp-module/tests/requirements.txt`:

```sh
cmake -S cpp-module -B cpp-module/build-qa -DCMAKE_BUILD_TYPE=Release -DPython3_EXECUTABLE=/root/.multiuav-qa-fixes/bin/python
cmake --build cpp-module/build-qa -j 4
ctest --test-dir cpp-module/build-qa --output-on-failure
PLANNER_LIB="$PWD/cpp-module/build-qa/libplanner.so" PYTHONPATH="$PWD/backend" PYTHONDONTWRITEBYTECODE=1 /root/.multiuav-qa-fixes/bin/python -m unittest discover -s backend/tests -v
QA_OUTPUT="$PWD/cpp-module/tests/qa-2026-10-04-fixed" /root/.multiuav-qa-fixes/bin/python cpp-module/tests/qa_run.py
QA_OUTPUT="$PWD/cpp-module/tests/qa-2026-10-04-fixed" /root/.multiuav-qa-fixes/bin/python cpp-module/tests/qa_response_validation.py
cmake -S cpp-module -B cpp-module/build-qa-sanitized -DCMAKE_BUILD_TYPE=Debug -DPLANNER_SANITIZERS=ON
cmake --build cpp-module/build-qa-sanitized -j 4
QA_OUTPUT="$PWD/cpp-module/tests/qa-2026-10-04-fixed" /root/.multiuav-qa-fixes/bin/python cpp-module/tests/qa_sanitizers.py
```

Прежние lint/Vite предупреждения остаются; они не относятся к исправленным отказам. LeakSanitizer отключён существующим набором (`detect_leaks=0`), утечки не проверялись. Геометрический поиск остаётся эвристикой: локальный безопасный обход не гарантирует глобально кратчайший маршрут. Тесты выполнены на перечисленных сценариях; проверки настоящего автопилота и всех браузеров не выполнялись.
