# Проверка MultiUAV Planner — 4 октября 2026

Проверены текущий checkout, Docker Compose (nginx + FastAPI + настоящий C++), Linux-сборка в WSL Ubuntu 24.04/GCC 13.3, браузер Codex на размерах 1440×900, 1000×800 и 390×844. Производственный сайт не тестировался. Код приложения не исправлялся.

| Набор | Результат |
|---|---|
| Frontend node:test | 11/11 PASS |
| Vite production build | PASS локально и в Docker |
| oxlint | 0 ошибок, 7 предупреждений |
| C++ Release build, CTest smoke | PASS |
| Независимая C ABI регрессия | 52 PASS, 1 FAIL, 1 SKIPPED |
| HTTP через nginx → FastAPI → C++ | 39 PASS, 12 FAIL из 51 проверки |
| Независимая геометрическая проверка HTTP-ответов | 8/8 PASS |
| ASan + UBSan | 47 JSON-сценариев + 10 некорректных/крайних входов PASS |

Число проваленных проверок не равно числу отдельных дефектов: несколько проверок воспроизводят одну проблему. Отрицательные сценарии, корректно отклонённые планировщиком, считаются PASS. LeakSanitizer отключён в существующем наборе (`detect_leaks=0`), отсутствие утечек не подтверждено.

## Найденные проблемы

1. **ZIP Mission Planner: одинаковые имена файлов для повторных вылетов.** Настоящий HTTP-план `multiple_sorties_http_response.json` содержит 6 вылетов одного БВС. ZIP содержит 6 записей `uav3.waypoints`. При обычном извлечении файлы конфликтуют, часть миссий может быть потеряна. Место: `backend/app/exporters.py`, `build_mission_planner_zip`.
2. **KML: не экранируются XML-символы в идентификаторах.** Передать в export ответ с `uav_id="test<&>"`: HTTP 200, но XML-парсер отвергает документ (`invalid token`, строка 6). Место: `backend/app/exporters.py`, генерация Style/Folder/Placemark.
3. **Ошибки входных данных возвращают HTTP 500.** Пустой полигон, отсутствие стартов, координата из одного числа, широта 91°, дубликат БВС, отрицательная скорость и невозможное временное окно проходят Python-схему и отклоняются C++ с `INVALID_REQUEST`/`INFEASIBLE`, но API преобразует их в 500. Для клиентского отказа ожидалась ошибка 4xx. Это существующее поведение общего обработчика `backend/app/main.py`, а не падение процесса. Health после всех случаев работает.
4. **Regression `base_request.json` с GSD=3.** Ожидался успешный план; фактически C ABI возвращает `RESOURCE_LIMIT: visibility graph exceeds 3000 vertices`, а HTTP — 500. Воспроизведено обоими путями. Само по себе это ограничение алгоритма; регрессионный набор и прежняя документация ожидают успех.
5. **Escape сохраняет переименование в компактной панели.** При ширине 1000 px открыть результаты, заменить имя `uav1` на `ESC ошибка`, нажать Escape. Панель закрывается, новое имя появляется в плеере и сохраняется. При 1440 px отмена работает. Вероятная причина: нативный обработчик Escape в `SidePanel` закрывает панель раньше React-обработчика поля, а blur сохраняет значение. Снимок: `escape-bug.jpg`.
6. **URL из README не работает через nginx.** POST `http://localhost:8080/v1/plan` с корректным запросом возвращает nginx 405. Рабочий путь — `/api/v1/plan`; Swagger/OpenAPI доступны и показывают backend-путь `/v1/plan`. Это несогласованность документации и проксирования, требующая выбора единого внешнего контракта.

## Что успешно проверено

RGB, Thermal и multispectral (для двух последних использованы синтетические камеры подходящего типа); оба критерия оптимизации; timezone offset; исходный пример фронтенда; прямой и обратный обход полигона; невыпуклый полигон; отверстия; самолётный радиус разворота; повторные вылеты; NFZ и временная 3D-разделённость через независимый validator; ссылки и формат PlanResponse; WGS84-длины, высоты, скорости, GSD, дистанция фотографирования и дальность; 8 конкурентных детерминированных вызовов как C ABI, так и HTTP; JSON, неверные методы/пути, CORS; содержимое стандартного ZIP и XML KML; встроенная база зон в Docker без исходных файлов.

Большой C ABI-сценарий: 100.02 км², 10 БВС, синтетические круговые и полигональные NFZ, 18 вылетов, 1882 waypoint, расчёт около 1.95 с, вместе с независимой валидацией около 3.0 с; покрытие исходного контура 97.008% с учётом исключений. Без дополнительных препятствий — 100% проверенной прямоугольной области. HTTP-большой сценарий использует штатную встроенную базу зон; синтетические препятствия передавались через окружение только C ABI-прогона.

В браузере: загрузка примера и реальный расчёт, результаты и маршруты, скрытие/возврат маршрутов, Enter и Escape при переименовании, проигрывание/пауза/скорость 120×/переход к посадке, создание пользовательского БВС, обязательное имя и согласованность скоростей, сброс результата при сохранении модели, расчёт с новой моделью (3 БВС), сохранение каталога/темы после reload, мобильная панель и отсутствие горизонтального переполнения, скрытый мобильный плеер. Console error/warn в момент проверки отсутствовали.

## Предупреждения и ограничения проверки

- oxlint: React ref во время render в `App.jsx`, 6 неиспользуемых переменных/импортов; Vite предупреждает о ESM-конфигурации без `type: module` и большом bundle.
- Исторический SHA-256 snapshot validator создан для прежнего checkout и включает все файлы вне cpp-module. Его проверка отдельно обозначена SKIPPED; исходные tracked-файлы проверены `git diff` после восстановления временного `.dockerignore`.
- В `test-data/regular.json` уже есть GSD; старое ожидание отказа из-за отсутствующего GSD устарело. Обёртка использует фактическое наличие поля, остальные проверки не ослаблены.
- Браузерная фиксация скачивания JSON не завершилась: API наблюдения download истёк по таймауту. Содержимое скачанного UI-файла и UI-импорт файла не подтверждены; round trip каталога покрыт unit-тестами, HTTP-экспорт проверен напрямую.
- Нет проверки во всех браузерах, на реальном мобильном устройстве, долговременного нагрузочного прогона или настоящего автопилота. Редактирование/рисование каждого инструмента карты не покрыто автоматизированным E2E.
- Первая Docker-сборка встретила служебную Linux symlink из созданного QA venv. Для сборки окружение временно исключалось из build context; это не дефект запуска приложения. QA venv удалён, исходный пустой `.dockerignore` восстановлен.

## Воспроизведение

Из корня проекта на Windows:

```powershell
docker compose up -d --build
node --test frontend/src/utils/*.test.mjs
cd frontend
node node_modules/vite/bin/vite.js build
node node_modules/oxlint/bin/oxlint --config .oxlintrc.json src
```

HTTP-проверки используют только стандартную библиотеку Python и работающий Docker stack:

```sh
python cpp-module/tests/qa_http.py
```

Для native-проверок в Linux/WSL из корня репозитория (venv лучше размещать вне Docker build context):

```sh
python3 -m venv /tmp/multiuav-qa-venv
/tmp/multiuav-qa-venv/bin/pip install -r cpp-module/tests/requirements.txt
cmake -S cpp-module -B cpp-module/build-qa -DCMAKE_BUILD_TYPE=Release
cmake --build cpp-module/build-qa -j 4
ctest --test-dir cpp-module/build-qa -R smoke --output-on-failure
/tmp/multiuav-qa-venv/bin/python cpp-module/tests/qa_run.py
/tmp/multiuav-qa-venv/bin/python cpp-module/tests/qa_response_validation.py
cmake -S cpp-module -B cpp-module/build-qa-sanitized -DCMAKE_BUILD_TYPE=Debug -DPLANNER_SANITIZERS=ON
cmake --build cpp-module/build-qa-sanitized -j 4
/tmp/multiuav-qa-venv/bin/python cpp-module/tests/qa_sanitizers.py
```

Отчёты: `acceptance.json`, `http-final.json`, `http_geometry.json`, `sanitizers.json`; запросы/ответы регрессии — `generated/`. Скриншоты — `desktop.jpg`, `escape-bug.jpg`, `mobile-results.jpg`, `mobile-dark.jpg`.
