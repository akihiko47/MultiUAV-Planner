#!/usr/bin/env python3
"""Run the native executable with ASan+UBSan (including vendored C code)."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
ROOT=Path(__file__).resolve().parents[1]
exe=ROOT/'build-sanitized/planner_test'
env=dict(os.environ,ASAN_OPTIONS='detect_leaks=0:halt_on_error=1',UBSAN_OPTIONS='halt_on_error=1:print_stacktrace=1')
report=[]
for request in sorted((ROOT/'tests/generated').glob('*_request.json')):
    if request.stem=='100km2_ten_uavs_with_nfz_request':
        continue  # Covered by optimized regression; avoid debug timeout.
    t=time.monotonic()
    proc=subprocess.run([str(exe),str(request)],capture_output=True,text=True,env=env,timeout=180)
    if proc.returncode not in (0,1):
        raise RuntimeError(f'{request.name}: exit {proc.returncode}\n{proc.stderr}')
    assert 'Sanitizer' not in proc.stderr and 'runtime error:' not in proc.stderr,proc.stderr
    response=json.loads(proc.stdout)
    assert ('error' in response)==(proc.returncode==1)
    report.append({'case':request.name,'status':'PASS','elapsed_seconds':round(time.monotonic()-t,3)})
base=json.loads((ROOT/'tests/smoke_request.json').read_text())
cases=[b'',b'{',b'null',b'[]',b'{"gsd":NaN}',b'{"gsd":1e400}']
for field,value in [('cruise_speed',1e-300),('min_turn_radius',1e-300),('climb_speed',1e-300),('max_speed',1e300)]:
    q=json.loads(json.dumps(base));q['uav_types'][1][field]=value;cases.append(json.dumps(q).encode())
for raw in cases:
    p=subprocess.run([str(exe)],input=raw,capture_output=True,env=env,timeout=10)
    assert p.returncode==1,(p.returncode,p.stderr)
    assert set(json.loads(p.stdout))=={'error'}
report.append({'case':'malformed_and_extreme_numeric_inputs','status':'PASS','inputs':len(cases)})
(ROOT/'tests/sanitizer_report.json').write_text(json.dumps(report,indent=2))
print(f'ASan+UBSan PASS: {len(report)-1} scenario requests + {len(cases)} malformed/extreme inputs')
