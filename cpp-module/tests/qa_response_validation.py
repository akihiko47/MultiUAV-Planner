"""Validate actual HTTP response geometry and native-only fallback against catalog."""
import json
import os
from pathlib import Path
import sys
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).parent))
from validate import validate
root=Path(__file__).resolve().parents[1]
out=Path(os.environ.get('QA_OUTPUT', root/'tests/qa-2026-10-04'))
zones=json.loads((root/'no-fly-zons/no_fly_zones.json').read_text())
report=[]
for name,req in [('smoke',root/'tests/smoke_request.json'),('frontend_example',root.parent/'frontend/src/data/request_example.json')]+[(n,out/'generated'/(n+'_request.json')) for n in ['holes','concave_polygon','clockwise_polygon','fixed_wing_turn_radius','multiple_sorties','100km2_ten_uavs']]:
    path=out/(name+'_http_response.json')
    if not path.exists() or not req.exists(): continue
    response=json.loads(path.read_text())
    try:
        metrics=validate(json.loads(req.read_text()),response,zones)
        assert any('embedded at build time' in w for w in response['warnings'])
        report.append(dict(name=name,status='PASS',embedded_zones=True,**metrics))
    except Exception as exc:
        report.append(dict(name=name,status='FAIL',error=str(exc)))
(out/'http_geometry.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
