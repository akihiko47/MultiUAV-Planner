# API планирования БВС

REST API для расчёта оптимальных полётных заданий группы БВС.

- **Base URL (dev)**: `http://localhost:8000`
- **Base URL (prod)**: `https://<домен>`
- **Формат**: JSON, `Content-Type: application/json`
- **Авторизация**: отсутствует

Интерактивная документация доступна по `/docs`, OpenAPI-схема — по `/openapi.json`.

## Endpoints

| Метод | Путь       | Назначение                     |
|-------|------------|--------------------------------|
| POST  | `/v1/plan` | Рассчитать полётные задания    |
| GET   | `/health`  | Проверка доступности сервиса   |

---

## POST /v1/plan

### Формат запроса

```json
{
  "survey_area": { ... },
  "start_points": [ ... ],
  "uav_types": [ ... ],
  "cameras": [ ... ],
  "uavs": [ ... ],
  "survey_type": "RGB",
  "gsd": 3.5,
  "optimization_criteria": "min_time",
  "operation_start_time": "2026-04-15T08:00:00Z",
  "operation_end_time": "2026-04-15T09:00:00Z"
}
```

Сервис принимает POST-запрос с телом в формате JSON. Входные данные включают:

- зону съёмки (полигон, возможно с отверстиями);
- возможные точки старта БВС;
- каталог типов БВС с их лётно-техническими характеристиками;
- каталог камер (полезных нагрузок) с их характеристиками;
- перечень доступных экземпляров БВС с указанием типа и установленной камеры;
- тип съёмки;
- требуемое пространственное разрешение (GSD);
- критерий оптимизации (опционально);
- время начала операции (опционально);
- время окончания операции (опционально).

Запретные зоны и резервные площадки посадки **не передаются** — они уже хранятся на стороне бэкенда.


### Детальное описание полей

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `survey_area` | GeoJSON Polygon | Да | Зона съёмки. Полигон может содержать внутренние отверстия (дырки). |
| `start_points` | Array | Да | Список возможных точек старта БВС. |
| `start_points[].id` | String | Да | Уникальный идентификатор точки старта. |
| `start_points[].coordinates` | Array | Да | Координаты точки в формате `[долгота, широта]`. |
| `uav_types` | Array | Да | Каталог типов (моделей) БВС с их характеристиками. |
| `uav_types[].id` | String | Да | Уникальный идентификатор типа БВС (например, `"geoscan_201"`). |
| `uav_types[].name` | String | Нет | Человекочитаемое название модели. |
| `uav_types[].max_flight_distance` | Number | Да | Максимальная дальность полёта (метры). |
| `uav_types[].max_distance_from_home` | Number | Да | Максимальное удаление от точки старта (метры). |
| `uav_types[].cruise_speed` | Number | Да | Крейсерская скорость (м/с). |
| `uav_types[].min_speed` | Number | Да | Минимальная скорость (м/с). |
| `uav_types[].max_speed` | Number | Да | Максимальная скорость (м/с). |
| `uav_types[].min_alt` | Number | Да | Минимальная высота полёта (метры). |
| `uav_types[].max_alt` | Number | Да | Максимальная высота полёта (метры). |
| `uav_types[].min_turn_radius` | Number | Да | Минимальный радиус виража (метры). |
| `uav_types[].min_voltage` | Number | Да | Минимальное напряжение питания (В). |
| `uav_types[].climb_speed` | Number | Да | Скорость набора высоты (м/с). |
| `uav_types[].descent_speed` | Number | Да | Скорость снижения (м/с). |
| `uav_types[].cameras` | Array of String | Да | Список `id` камер из каталога `cameras`, совместимых с этим типом БВС. |
| `cameras` | Array | Да | Каталог камер (полезных нагрузок). |
| `cameras[].id` | String | Да | Уникальный идентификатор камеры. |
| `cameras[].name` | String | Нет | Человекочитаемое название камеры. |
| `cameras[].type` | String | Да | Тип камеры: `"RGB"`, `"Multispectral"`, `"Thermal"`. |
| `cameras[].focalLength` | Number | Да | Фокусное расстояние (мм). |
| `cameras[].matrixX` | Number | Да | Физическая ширина матрицы (мм). |
| `cameras[].matrixY` | Number | Да | Физическая высота матрицы (мм). |
| `cameras[].matrixPixX` | Number | Да | Ширина снимка в пикселях. |
| `cameras[].matrixPixY` | Number | Да | Высота снимка в пикселях. |
| `uavs` | Array | Да | Список доступных экземпляров БВС. |
| `uavs[].id` | String | Да | Уникальный идентификатор экземпляра БВС. |
| `uavs[].type_id` | String | Да | Ссылка на `id` из `uav_types`. |
| `uavs[].camera_id` | String | Да | Ссылка на `id` из `cameras` (камера, установленная на этом БВС). |
| `survey_type` | String | Да | Тип съёмки. Допустимые значения: `"RGB"`, `"multispectral"`, `"Thermal"`, `"LiDAR"`, `"geophysical"`. |
| `gsd` | Number | Да | Требуемое пространственное разрешение (GSD), см/пиксель. Допустимый диапазон: `[0.1, 100]`. По этому значению алгоритм рассчитывает высоту съёмки для каждой камеры. |
| `optimization_criteria` | String | Нет | Критерий оптимизации: `"min_time"` (минимизация времени выполнения работ) или `"min_flight_distance"` (минимизация суммарного налёта). По умолчанию `"min_time"`. |
| `operation_start_time` | String (ISO 8601) | Нет | Планируемое время начала операции (время первого взлёта). Если не указано, используется текущее время или значение по умолчанию. |
| `operation_end_time` | String (ISO 8601) | Нет | Планируемое время окончания операции (время последней посадки). |

### Формат зоны съёмки

Используется стандарт GeoJSON. Поддерживается тип `Polygon`, который может содержать внутренние отверстия. Структура:
```json
{
  "type": "Polygon",
  "coordinates": [
    [ [lon, lat], [lon, lat], ... ],
    [ [lon, lat], [lon, lat], ... ],
    [ [lon, lat], [lon, lat], ... ]
  ]
}
```

- Первое кольцо — внешняя граница полигона.
- Последующие кольца — отверстия (например, озёра, запретные зоны внутри участка).
- Каждое кольцо должно быть замкнуто (первая и последняя точки совпадают).
- Координаты задаются в порядке `[долгота, широта]`.

### Пример запроса

```json
{
  "survey_area": {
    "type": "Polygon",
    "coordinates": [
      [
        [37.674608, 56.027098],
        [37.678685, 56.024988],
        [37.688599, 56.022399],
        [37.692504, 56.026307],
        [37.686367, 56.028393],
        [37.678556, 56.028536],
        [37.674608, 56.027098]
      ],
      [
        [37.685702, 56.024496],
        [37.687740, 56.026618],
        [37.689586, 56.026234],
        [37.687526, 56.023981],
        [37.685702, 56.024496]
      ]
    ]
  },
  "start_points": [
    { "id": "sp1", "coordinates": [37.70799636840821, 56.02146546402811] },
    { "id": "sp2", "coordinates": [37.690626382827766, 56.02743267537338] },
    { "id": "sp3", "coordinates": [37.67453312873841, 56.02555038106746] },
    { "id": "sp4", "coordinates": [37.686163187026985, 56.02204927167073] }
  ],
  "uav_types": [
    {
      "id": "geoscan_201",
      "name": "Геоскан 201",
      "max_flight_distance": 210000,
      "max_distance_from_home": 100000,
      "cruise_speed": 25,
      "min_speed": 17.8,
      "max_speed": 36.1,
      "min_alt": 100,
      "max_alt": 4000,
      "min_turn_radius": 50,
      "min_voltage": 15,
      "climb_speed": 5,
      "descent_speed": 3,
      "cameras": [
        "riebo_r4",
        "riebo_r6",
        "sony_dsc_rx1rm3",
        "sony_dsc_rx1rm2",
        "sony_zv_e10",
        "geoscan_pollux"
      ]
    },
    {
      "id": "geoscan_gemini",
      "name": "Геоскан Gemini",
      "max_flight_distance": 30000,
      "max_distance_from_home": 5000,
      "cruise_speed": 15,
      "min_speed": 0,
      "max_speed": 15,
      "min_alt": 25,
      "max_alt": 500,
      "min_turn_radius": 0,
      "min_voltage": 15,
      "climb_speed": 5,
      "descent_speed": 3,
      "cameras": [
        "geoscan_pf1b",
        "geoscan_pollux",
        "sony_umc_r10c"
      ]
    }
  ],
  "cameras": [
    {
      "id": "geoscan_pf1b",
      "name": "Geoscan PF1B",
      "type": "RGB",
      "focalLength": 20,
      "matrixX": 23.5,
      "matrixY": 15.6,
      "matrixPixX": 6000,
      "matrixPixY": 4000
    },
    {
      "id": "riebo_r4",
      "name": "Riebo R4",
      "type": "RGB",
      "focalLength": 40,
      "matrixX": 35.9,
      "matrixY": 23.9,
      "matrixPixX": 9504,
      "matrixPixY": 6336
    }
  ],
  "uavs": [
    { "id": "uav1", "type_id": "geoscan_201",    "camera_id": "riebo_r4" },
    { "id": "uav2", "type_id": "geoscan_201",    "camera_id": "riebo_r4" },
    { "id": "uav3", "type_id": "geoscan_gemini", "camera_id": "geoscan_pf1b" }
  ],
  "survey_type": "RGB",
  "gsd": 4,
  "optimization_criteria": "min_flight_distance",
  "operation_start_time": "2026-10-20T07:25:00.000Z",
  "operation_end_time": "2026-10-20T08:25:00.000Z"
}
```

---

## Формат ответа

Сервис возвращает ответ в формате JSON. Выходные данные включают:

- сводную информацию по всей операции;
- список индивидуальных полётных заданий для каждого задействованного БВС;
- предупреждения (если есть).

#### Структура ответа
```json
{
  "summary": { ... },
  "uav_assignments": [ ... ],
  "warnings": [ ... ]
}
```

#### Сводная информация (`summary`)

| Поле | Тип | Описание |
|------|-----|----------|
| `optimization_criteria` | String | Использованный критерий оптимизации: `"min_time"` или `"min_flight_distance"`. |
| `total_time` | Number | Суммарное время выполнения работ (секунды). |
| `total_distance` | Number | Суммарный налёт (метры). |
| `uavs_used` | Integer | Количество задействованных БВС. |
| `uavs_total` | Integer | Общее количество доступных БВС. |
| `operation_start` | String (ISO 8601) | Время начала операции (ранний взлёт среди всех БВС). |
| `operation_end` | String (ISO 8601) | Время завершения операции (поздняя посадка среди всех БВС). |

#### Индивидуальное полётное задание (`uav_assignments[]`)

| Поле | Тип | Описание |
|------|-----|----------|
| `uav_id` | String | Идентификатор экземпляра БВС из входных данных. |
| `type_id` | String | Идентификатор типа БВС из `uav_types`. |
| `camera_id` | String | Идентификатор камеры, установленной на этом БВС. |
| `takeoff_time` | String (ISO 8601) | Время взлёта конкретного БВС. |
| `landing_time` | String (ISO 8601) | Время посадки конкретного БВС. |
| `start_point` | Object | Точка старта: `{ "id": "...", "coordinates": [lon, lat] }`. |
| `landing_point` | Object | Точка посадки: `{ "id": "...", "coordinates": [lon, lat] }`. |
| `route` | GeoJSON LineString | Общий маршрут полёта (все точки последовательно). |
| `waypoints` | Array | Детализированный список ключевых точек с параметрами. |
| `estimated_time` | Number | Оценочное время выполнения задания (секунды). |
| `estimated_distance` | Number | Оценочная длина маршрута (метры). |
| `battery_usage` | Number | Оценочный расход заряда (проценты). |

#### Ключевые точки (`waypoints[]`)

| Поле | Тип | Описание |
|------|-----|----------|
| `sequence` | Integer | Порядковый номер точки. |
| `coordinates` | Array | `[lon, lat]`. |
| `altitude` | Number | Высота в метрах. |
| `speed` | Number | Скорость в м/с. |
| `action` | String | Действие: `"takeoff"`, `"transit"`, `"line_begin"`, `"line_end"`, `"waypoint"`, `"landing"`. |
| `photo_distance` | Number (optional) | Расстояние между срабатываниями затвора (метры). Заполняется только для `line_begin`. |
| `time` | String (ISO 8601) | Время прохождения ключевой точки. |

**Семантика `action`:**

- `takeoff` — взлёт в точке старта.
- `transit` — перелёт без съёмки (между галсами, к точке старта галса и т.п.).
- `line_begin` — начало съёмочного галса. Здесь включается съёмка с шагом `photo_distance`.
- `line_end` — конец съёмочного галса. Съёмка выключается.
- `waypoint` — промежуточная точка маршрута, не привязанная к съёмке.
- `landing` — посадка.

**Пример последовательности для миссии с двумя галсами:**

1. `takeoff`
2. `transit` (к началу первого галса)
3. `line_begin` (`photo_distance: 43`)
4. `line_end`
5. `transit` (к началу второго галса)
6. `line_begin` (`photo_distance: 43`)
7. `line_end`
8. `transit` (обратно к точке посадки)
9. `landing`

#### Пример ответа
```json
{
  "summary": {
    "optimization_criteria": "min_time",
    "total_time": 3600,
    "total_distance": 45000,
    "uavs_used": 2,
    "uavs_total": 3,
    "operation_start": "2026-04-15T08:00:00Z",
    "operation_end": "2026-04-15T09:00:00Z"
  },
  "uav_assignments": [
    {
      "uav_id": "uav1",
      "type_id": "geoscan_201",
      "camera_id": "riebo_r4",
      "takeoff_time": "2026-04-15T08:00:00Z",
      "landing_time": "2026-04-15T08:23:00Z",
      "start_point": { "id": "sp1", "coordinates": [37.6200, 55.7200] },
      "landing_point": { "id": "sp1", "coordinates": [37.6200, 55.7200] },
      "route": {
        "type": "LineString",
        "coordinates": [
          [37.6200, 55.7200],
          [37.6210, 55.7210],
          [37.6300, 55.7300],
          [37.6400, 55.7400],
          [37.6300, 55.7400],
          [37.6200, 55.7300],
          [37.6210, 55.7210],
          [37.6200, 55.7200]
        ]
      },
      "waypoints": [
        {
          "sequence": 1,
          "coordinates": [37.6200, 55.7200],
          "altitude": 0,
          "speed": 0,
          "action": "takeoff",
          "time": "2026-04-15T08:00:00Z"
        },
        {
          "sequence": 2,
          "coordinates": [37.6210, 55.7210],
          "altitude": 120,
          "speed": 15,
          "action": "transit",
          "time": "2026-04-15T08:01:00Z"
        },
        {
          "sequence": 3,
          "coordinates": [37.6300, 55.7300],
          "altitude": 120,
          "speed": 15,
          "action": "line_begin",
          "photo_distance": 43,
          "time": "2026-04-15T08:02:00Z"
        },
        {
          "sequence": 4,
          "coordinates": [37.6400, 55.7400],
          "altitude": 120,
          "speed": 15,
          "action": "line_end",
          "time": "2026-04-15T08:10:00Z"
        },
        {
          "sequence": 5,
          "coordinates": [37.6300, 55.7400],
          "altitude": 120,
          "speed": 15,
          "action": "transit",
          "time": "2026-04-15T08:11:00Z"
        },
        {
          "sequence": 6,
          "coordinates": [37.6200, 55.7300],
          "altitude": 120,
          "speed": 15,
          "action": "line_begin",
          "photo_distance": 43,
          "time": "2026-04-15T08:12:00Z"
        },
        {
          "sequence": 7,
          "coordinates": [37.6300, 55.7300],
          "altitude": 120,
          "speed": 15,
          "action": "line_end",
          "time": "2026-04-15T08:20:00Z"
        },
        {
          "sequence": 8,
          "coordinates": [37.6210, 55.7210],
          "altitude": 120,
          "speed": 15,
          "action": "transit",
          "time": "2026-04-15T08:21:00Z"
        },
        {
          "sequence": 9,
          "coordinates": [37.6200, 55.7200],
          "altitude": 0,
          "speed": 0,
          "action": "landing",
          "time": "2026-04-15T08:23:00Z"
        }
      ],
      "estimated_time": 1380,
      "estimated_distance": 17500,
      "battery_usage": 45
    }
  ],
  "warnings": []
}
```