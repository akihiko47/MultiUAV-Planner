import logging
from io import BytesIO

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from app.models import PlanRequest, PlanResponse
from app.planner_client import call_planner
from app.exporters import build_mission_planner_zip, build_geoscan_kml_bytes

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Geoscan Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/v1/plan", response_model=PlanResponse)
async def plan(request: PlanRequest):
    request_json = request.model_dump_json()

    try:
        result_dict = await run_in_threadpool(call_planner, request_json)
    except Exception as e:
        logger.exception("Planner call failed")
        raise HTTPException(status_code=500, detail=str(e))

    try:
        return PlanResponse.model_validate(result_dict)
    except ValidationError as e:
        logger.exception("Planner returned invalid response")
        raise HTTPException(
            status_code=502,
            detail=f"Planner returned invalid response: {e}",
        )

#  Экспорт: Mission Planner (.zip)
@app.post("/v1/export/mission-planner")
async def export_mission_planner(plan: PlanResponse):
    try:
        data = await run_in_threadpool(build_mission_planner_zip, plan)
    except Exception as e:
        logger.exception("Mission Planner export failed")
        raise HTTPException(status_code=500, detail=str(e))

    return StreamingResponse(
        BytesIO(data),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="mission_planner.zip"',
        },
    )

#  Экспорт: Geoscan Planner (.kml)
@app.post("/v1/export/geoscan-kml")
async def export_geoscan_kml(plan: PlanResponse):
    try:
        data = await run_in_threadpool(build_geoscan_kml_bytes, plan)
    except Exception as e:
        logger.exception("Geoscan KML export failed")
        raise HTTPException(status_code=500, detail=str(e))

    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.google-earth.kml+xml",
        headers={
            "Content-Disposition": 'attachment; filename="geoscan_plan.kml"',
        },
    )