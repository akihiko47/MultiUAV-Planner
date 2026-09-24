import logging

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.models import PlanRequest, PlanResponse
from app.planner_client import call_planner

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