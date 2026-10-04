"""Black-box tests of Docker nginx -> FastAPI -> production native library."""
import copy
from concurrent.futures import ThreadPoolExecutor
import io
import json
import os
from pathlib import Path
import time
import urllib.request
import urllib.error
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('QA_OUTPUT', ROOT / 'tests/qa-2026-10-04'))
OUT.mkdir(exist_ok=True)
BASE = os.environ.get('QA_URL', 'http://127.0.0.1:8080')
report = []

def request(path, payload=None, raw=None, headers=None, method=None):
    data = raw if raw is not None else (json.dumps(payload).encode() if payload is not None else None)
    req = urllib.request.Request(BASE + path, data=data, headers=headers or {'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return response.status, dict(response.headers), response.read()
    except urllib.error.HTTPError as response:
        return response.code, dict(response.headers), response.read()

def check(name, func):
    t = time.monotonic()
    try:
        details = func() or {}
        row = dict(name=name, status='PASS', **details)
    except Exception as exc:
        row = dict(name=name, status='FAIL', error=str(exc))
    row['elapsed_seconds'] = round(time.monotonic()-t, 3)
    report.append(row)
    print(json.dumps(row, ensure_ascii=False), flush=True)
    (OUT / 'http.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

def expect(path, code, **kwargs):
    status, headers, body = request(path, **kwargs)
    assert status == code, f'expected {code}, got {status}: {body[:400]!r}'
    return status, headers, body

for path in ['/', '/docs', '/openapi.json', '/redoc', '/api/health']:
    check('GET '+path, lambda p=path: {'http': expect(p, 200)[0]})
base = json.loads((ROOT/'tests/smoke_request.json').read_text())
check('documented README plan URL', lambda: {'http': expect('/v1/plan', 200, payload=base)[0]})
original_base=json.loads((ROOT/'test-data/base_request.json').read_text())
original_base['gsd']=3
check('original base_request with explicit GSD', lambda: {'http':expect('/api/v1/plan',200,payload=original_base)[0]})

def plan(payload, name):
    status, _, body = expect('/api/v1/plan', 200, payload=payload)
    value = json.loads(body)
    assert value['uav_assignments']
    assert value['summary']['total_distance'] > 0
    (OUT/(name+'_http_response.json')).write_bytes(body)
    return value

result = plan(base, 'smoke')
check('smoke real planner', lambda: {'sorties':len(result['uav_assignments'])})
for name, payload in [('frontend_example',json.loads((ROOT.parent/'frontend/src/data/request_example.json').read_text())),
                      ('min_flight_distance',dict(base,optimization_criteria='min_flight_distance')),
                      ('timezone_offset',dict(base,operation_start_time='2026-10-20T10:25:00+03:00'))]:
    check('plan '+name, lambda p=payload,n=name: {'sorties':len(plan(p,n)['uav_assignments'])})

for name, edit in [
    ('missing_gsd',lambda p:p.pop('gsd')), ('zero_gsd',lambda p:p.update(gsd=0)),
    ('negative_gsd',lambda p:p.update(gsd=-1)), ('too_large_gsd',lambda p:p.update(gsd=101)),
    ('lidar',lambda p:p.update(survey_type='LiDAR')), ('geophysical',lambda p:p.update(survey_type='geophysical')),
    ('unknown_type',lambda p:p['uavs'][0].update(type_id='unknown')),
    ('unknown_camera',lambda p:p['uavs'][0].update(camera_id='unknown')),
    ('invalid_date',lambda p:p.update(operation_start_time='2026-02-30T00:00:00Z')),
    ('no_uavs',lambda p:p.update(uavs=[])), ('wrong_geometry_type',lambda p:p['survey_area'].update(type='MultiPolygon')),
]:
    payload = copy.deepcopy(base); edit(payload)
    check('validation '+name, lambda p=payload: {'http':expect('/api/v1/plan',422,payload=p)[0]})

for name, edit in [
    ('empty_polygon',lambda p:p['survey_area'].update(coordinates=[])),
    ('no_starts',lambda p:p.update(start_points=[])),
    ('bad_coordinate_dimension',lambda p:p['start_points'][0].update(coordinates=[10])),
    ('invalid_latitude',lambda p:p['start_points'][0].update(coordinates=[10,91])),
    ('duplicate_uav',lambda p:p['uavs'].append(copy.deepcopy(p['uavs'][0]))),
    ('negative_speed',lambda p:p['uav_types'][1].update(cruise_speed=-1)),
    ('infeasible_time',lambda p:p.update(operation_end_time='2026-10-20T07:25:01Z')),
]:
    payload = copy.deepcopy(base); edit(payload)
    check('client error semantics '+name, lambda p=payload: {'http':expect('/api/v1/plan',422,payload=p)[0]})

check('malformed JSON',lambda:{'http':expect('/api/v1/plan',422,raw=b'{')[0]})
check('empty JSON',lambda:{'http':expect('/api/v1/plan',422,payload={})[0]})
check('wrong method',lambda:{'http':expect('/api/v1/plan',405)[0]})
check('unknown API path',lambda:{'http':expect('/api/unknown',404)[0]})
check('CORS preflight',lambda:{'http':expect('/api/v1/plan',200,method='OPTIONS',headers={'Origin':'http://localhost:8080','Access-Control-Request-Method':'POST'})[0]})

def concurrent():
    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(lambda _: request('/api/v1/plan',base),range(8)))
    assert all(r[0]==200 for r in responses)
    values = [json.loads(r[2]) for r in responses]
    assert all(v == values[0] for v in values)
    return {'calls':8, 'deterministic':True}
check('8 concurrent HTTP calculations',concurrent)

def export_zip(value, unique=True):
    _, headers, body = expect('/api/v1/export/mission-planner',200,payload=value)
    assert 'application/zip' in headers['Content-Type']
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        assert len(names)==len(value['uav_assignments'])
        if unique: assert len(set(names))==len(names), f'duplicate filenames: {names}'
        for item in archive.infolist():
            lines=archive.read(item).decode().splitlines()
            assert lines[0]=='QGC WPL 110'
            assert all(len(line.split('\t'))==12 for line in lines[1:])
        for assignment, item in zip(value['uav_assignments'], archive.infolist()):
            lines=archive.read(item).decode().splitlines()[2:]
            nav=[line for line in lines if int(line.split('\t')[3]) in (16,21,22)]
            assert len(nav)==len(assignment['waypoints'])
    (OUT/'mission_planner.zip').write_bytes(body)
    return {'files':names}
check('Mission Planner ZIP',lambda:export_zip(result))

def export_kml(value):
    _, headers, body = expect('/api/v1/export/geoscan-kml',200,payload=value)
    assert 'kml' in headers['Content-Type']
    root=ET.fromstring(body)
    ns={'k':'http://www.opengis.net/kml/2.2'}
    assert len(root.findall('.//k:Folder',ns))==len(value['uav_assignments'])
    folders=root.findall('.//k:Folder',ns)
    assert [f.find('k:name',ns).text for f in folders]==[f"{a['uav_id']} ({a['type_id']})" for a in value['uav_assignments']]
    styles=root.findall('.//k:Style',ns)
    identifiers=[s.attrib['id'] for s in styles]
    assert len(set(identifiers))==len(identifiers)
    assert all(s.text[1:] in identifiers for s in root.findall('.//k:styleUrl',ns))
    (OUT/'geoscan_plan.kml').write_bytes(body)
    return {'folders':len(root.findall('.//k:Folder',ns))}
check('Geoscan KML',lambda:export_kml(result))
for endpoint in ['mission-planner','geoscan-kml']:
    check('invalid export '+endpoint, lambda e=endpoint:{'http':expect('/api/v1/export/'+e,422,payload={})[0]})
repeat=copy.deepcopy(result)
repeat['uav_assignments'].append(copy.deepcopy(repeat['uav_assignments'][0]))
check('repeat sortie unique ZIP filenames',lambda:export_zip(repeat))
special=copy.deepcopy(result)
special['uav_assignments'][0]['uav_id']='test<&>'
check('KML XML escaping of UAV id',lambda:export_kml(special))
special['uav_assignments'][0]['type_id']='type<&>"'
special['uav_assignments'][0]['camera_id']='camera]]>tail<&>'
check('KML type and CDATA escaping',lambda:export_kml(special))
check('repeat sortie distinct KML styles',lambda:export_kml(repeat))
colliding=copy.deepcopy(repeat)
colliding['uav_assignments'].append(copy.deepcopy(result['uav_assignments'][0]))
colliding['uav_assignments'][-1]['uav_id']=result['uav_assignments'][0]['uav_id']+'_sortie_1'
check('ZIP suffix collision',lambda:export_zip(colliding))
unsafe=copy.deepcopy(result)
unsafe['uav_assignments'][0]['uav_id']='../folder/uav'
check('ZIP path encoding',lambda:export_zip(unsafe))
check('canonical health',lambda:{'http':expect('/health',200)[0]})
for scenario in ['holes','concave_polygon','clockwise_polygon','fixed_wing_turn_radius','multiple_sorties','100km2_ten_uavs']:
    fixture=OUT/'generated'/(scenario+'_request.json')
    if fixture.exists():
        check('HTTP scenario '+scenario,lambda p=json.loads(fixture.read_text()),n=scenario:{'sorties':len(plan(p,n)['uav_assignments'])})
multiple=OUT/'multiple_sorties_http_response.json'
if multiple.exists():
    check('actual multi-sortie ZIP filenames',lambda:export_zip(json.loads(multiple.read_text())))
for mode, camera_type in [('multispectral','Multispectral'),('Thermal','Thermal')]:
    payload=copy.deepcopy(base)
    for camera in payload['cameras']: camera['type']=camera_type
    payload['survey_type']=mode
    check('HTTP survey '+mode,lambda p=payload,n=mode:{'sorties':len(plan(p,n)['uav_assignments'])})
check('health after negative and concurrent cases',lambda:{'http':expect('/api/health',200)[0]})
print('TOTAL',len(report),'PASS',sum(r['status']=='PASS' for r in report),'FAIL',sum(r['status']=='FAIL' for r in report))
