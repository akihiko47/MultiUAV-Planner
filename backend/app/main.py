import logging
logger = logging.getLogger("uvicorn.error")

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from app.models import PlanRequest, PlanResponse
from app.planner_client import call_planner

app = FastAPI(title="Geoscan Planner API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/v1/plan", response_model=PlanResponse)
async def plan(request: PlanRequest):
    try:
        request_json = request.model_dump_json()
        result_dict = await run_in_threadpool(call_planner, request_json)
        return PlanResponse.model_validate(result_dict)

    except Exception as e:
        logger.exception("Planning failed")
        raise HTTPException(status_code=500, detail=str(e))
        