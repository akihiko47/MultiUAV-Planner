#!/usr/bin/env python3
"""Exercise unchanged backend and library-only (Docker runtime equivalent) loading."""
import importlib
import json
import os
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools'))
sys.path.insert(0, str(ROOT / 'tests'))
from validate import ABI, validate, environment

lib = ROOT / 'build-clean/libplanner.so'
if not lib.exists():
    lib = ROOT / 'build/libplanner.so'
os.environ['PLANNER_LIB'] = str(lib)
sys.path.insert(0, str(ROOT.parent / 'backend'))
from fastapi.testclient import TestClient
from app.main import app

request = json.loads((ROOT / 'tests/smoke_request.json').read_text())
zone_path = ROOT / 'no-fly-zons/no_fly_zones.json'
zones = json.loads(zone_path.read_text())
report = []
with TestClient(app) as client:
    assert client.get('/health').json() == {'status':'ok'}
    response = client.post('/v1/plan',json=request)
    assert response.status_code == 200, response.text
    validate(request,response.json(),zones)
    report.append({'test':'unchanged_backend_success','status':200})
    invalid = dict(request)
    invalid.pop('gsd')
    assert client.post('/v1/plan',json=invalid).status_code == 422
    report.append({'test':'unchanged_backend_missing_gsd','status':422})
    impossible = dict(request,operation_end_time='2026-10-20T07:25:01Z')
    assert client.post('/v1/plan',json=impossible).status_code == 500
    report.append({'test':'unchanged_backend_infeasible','status':500})
    assert client.post('/v1/plan',json=dict(request,survey_type='LiDAR')).status_code==422
    report.append({'test':'unchanged_backend_lidar_contract','status':422})
    mp=dict(request,survey_area={'type':'MultiPolygon','coordinates':[request['survey_area']['coordinates']]})
    assert client.post('/v1/plan',json=mp).status_code==422
    report.append({'test':'unchanged_backend_multipolygon_contract','status':422})

# The existing Dockerfile copies only libplanner.so. Hide the source dataset
# inside cpp-module and change cwd; ensure the exact build snapshot still works.
hidden = zone_path.with_suffix('.temporarily-hidden')
previous_cwd = Path.cwd()
try:
    zone_path.rename(hidden)
    os.chdir(ROOT / 'tests')
    with environment(PLANNER_NO_FLY_ZONES=None):
        result = ABI(lib).call(request)
    assert any('embedded at build time' in w for w in result['warnings'])
    validate(request,result,zones)
    report.append({'test':'library_only_embedded_zones','status':'PASS'})
finally:
    os.chdir(previous_cwd)
    if hidden.exists():
        hidden.rename(zone_path)
(ROOT/'tests/integration_report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
