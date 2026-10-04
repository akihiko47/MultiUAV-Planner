#!/usr/bin/env python3
"""Independent acceptance tests. No writes outside cpp-module.
Requires pydantic>=2, shapely>=2, pyproj. Runs through the production C ABI.
"""
import argparse
import copy
import ctypes
import datetime as dt
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import time
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
# Optional local dependencies used in the isolated validation environment.
if (ROOT / '.tools').exists():
    sys.path.insert(0, str(ROOT / '.tools'))
try:
    import numpy as np
    from pyproj import Geod
    from shapely.geometry import Polygon, LineString, Point, shape, box
    from shapely.ops import unary_union
    from shapely.strtree import STRtree
except ImportError as e:
    raise SystemExit('Install tests/requirements.txt first: ' + str(e))

spec = importlib.util.spec_from_file_location('backend_models', ROOT.parent / 'backend/app/models.py')
models = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = models
spec.loader.exec_module(models)
GEOD = Geod(ellps='WGS84')


def source_snapshot():
    """Check that this run leaves application sources untouched, not an old revision."""
    paths = [ROOT.parent / name for name in ('README.md', 'docker-compose.yml', '.dockerignore')]
    for directory in ('backend/app', 'frontend/src', 'docs'):
        paths.extend(p for p in (ROOT.parent / directory).rglob('*')
                     if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc')
    return {str(p.relative_to(ROOT.parent)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in paths}


def epoch(s):
    return dt.datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()


@contextmanager
def environment(**values):
    old = {k: os.environ.get(k) for k in values}
    try:
        for k, v in values.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = str(v)
        yield
    finally:
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


class ABI:
    def __init__(self, path):
        self.lib = ctypes.CDLL(str(Path(path).resolve()))
        self.lib.plan_json.argtypes = [ctypes.c_char_p]
        self.lib.plan_json.restype = ctypes.c_void_p
        self.lib.free_string.argtypes = [ctypes.c_void_p]
        self.lib.free_string.restype = None

    def call(self, request):
        raw = request if isinstance(request, bytes) or request is None else json.dumps(request).encode()
        p = self.lib.plan_json(raw)
        assert p, 'unexpected null allocation'
        try:
            text = ctypes.string_at(p).decode('utf-8')
            return json.loads(text, parse_constant=lambda v: (_ for _ in ()).throw(AssertionError(v)))
        finally:
            self.lib.free_string(p)


def metric(origin):
    # WGS84 tangent scale, independently expressed as meridian and prime vertical radii.
    longitude, latitude = origin
    a, flattening = 6378137., 1 / 298.257223563
    e2 = flattening * (2 - flattening)
    phi = math.radians(latitude)
    denom = 1 - e2 * math.sin(phi) ** 2
    sx = math.pi / 180 * a * math.cos(phi) / math.sqrt(denom)
    sy = math.pi / 180 * a * (1 - e2) / denom ** 1.5
    def project(coords):
        c = np.asarray(coords, dtype=float)
        return (c - np.array([longitude, latitude])) * np.array([sx, sy])
    return project


def check_finite(o):
    if isinstance(o, float):
        assert math.isfinite(o), 'non-finite result'
    elif isinstance(o, dict):
        for v in o.values():
            check_finite(v)
    elif isinstance(o, list):
        for v in o:
            check_finite(v)


def closest_approach(a, b):
    """Exact minimum on each overlapping pair of piecewise linear time segments."""
    ta, pa = a
    tb, pb = b
    if ta[-1] < tb[0] or tb[-1] < ta[0]:
        return math.inf
    if np.any(pa.max(axis=0) + 30 < pb.min(axis=0)) or np.any(pb.max(axis=0) + 30 < pa.min(axis=0)):
        return math.inf
    i = j = 1
    answer = math.inf
    while i < len(ta) and j < len(tb):
        lo, hi = max(ta[i-1], tb[j-1]), min(ta[i], tb[j])
        if hi >= lo:
            def pos(t, ts, ps, k):
                length = ts[k] - ts[k-1]
                f = (t-ts[k-1])/length if length > 1e-9 else 0
                return ps[k-1] + np.clip(f, 0, 1)*(ps[k]-ps[k-1])
            delta = pos(lo, ta, pa, i)-pos(lo, tb, pb, j)
            change = pos(hi, ta, pa, i)-pos(hi, tb, pb, j)-delta
            vv = float(change @ change)
            f = np.clip(-float(delta @ change)/vv, 0, 1) if vv > 1e-15 else 0
            answer = min(answer, float(np.linalg.norm(delta + f*change)))
        ae, be = ta[i], tb[j]
        if ae <= be:
            i += 1
        if be <= ae:
            j += 1
    return answer


def validate(request, result, zone_data):
    assert 'error' not in result, result.get('error')
    models.PlanResponse.model_validate(result)
    check_finite(result)
    area = request['survey_area']
    polygons = [area['coordinates']] if area['type'] == 'Polygon' else area['coordinates']
    project = metric(polygons[0][0][0])
    survey = unary_union([Polygon(project(p[0]), [project(h) for h in p[1:]]) for p in polygons])
    holes = [Polygon(project(h)) for p in polygons for h in p[1:]]
    all_coords = [w['coordinates'] for a in result['uav_assignments'] for w in a['waypoints']]
    p_all = project(all_coords)
    bounds = box(p_all[:,0].min()-100, p_all[:,1].min()-100, p_all[:,0].max()+100, p_all[:,1].max()+100)
    exclusions = list(holes)
    for z in zone_data['zones']:
        if z['type'] == 'polygon':
            poly = Polygon(project([[lon, lat] for lat, lon in z['coordinates']]))
            if not poly.is_valid:
                poly = poly.buffer(0)
        else:
            lat, lon = z['center']
            # Construct circle independently on the WGS84 ellipsoid.
            n = 128
            lons, lats, _ = GEOD.fwd(np.full(n, lon), np.full(n, lat), np.arange(n)*360/n,
                                    np.full(n, z['radius_km']*1000))
            poly = Polygon(project(np.column_stack([lons, lats])))
        if poly.intersects(bounds):
            exclusions.append(poly)
    tree = STRtree(exclusions)
    types = {v['id']: v for v in request['uav_types']}
    uavs = {v['id']: v for v in request['uavs']}
    cameras = {v['id']: v for v in request['cameras']}
    starts = {v['id']: v for v in request['start_points']}
    trajectories = []
    sortie_times = {}
    assigned_bases = {}
    all_footprints = []
    total_distance = 0
    for assignment in result['uav_assignments']:
        u = uavs[assignment['uav_id']]
        assert assignment['type_id'] == u['type_id']
        assert assignment['camera_id'] == u['camera_id']
        ut, cam = types[u['type_id']], cameras[u['camera_id']]
        assert u['camera_id'] in ut['cameras']
        assert ('multispectral' if cam['type'] == 'Multispectral' else cam['type']) == request['survey_type']
        for key in ['start_point', 'landing_point']:
            assert assignment[key] == starts[assignment[key]['id']]
        previous_base = assigned_bases.setdefault(u['id'], assignment['start_point'])
        assert assignment['start_point'] == previous_base, 'unmodeled relocation between sorties'
        w = assignment['waypoints']
        assert w[0]['action'] == 'takeoff' and w[-1]['action'] == 'landing'
        assert w[0]['altitude'] == w[-1]['altitude'] == 0
        assert [v['sequence'] for v in w] == list(range(len(w)))
        coords = np.array([v['coordinates'] for v in w])
        assert assignment['route']['coordinates'] == coords.tolist()
        assert coords[0].tolist() == assignment['start_point']['coordinates']
        assert np.allclose(coords[-1], assignment['landing_point']['coordinates'], atol=1e-10, rtol=0)
        xy = project(coords)
        z = np.array([v['altitude'] for v in w])
        times = np.array([epoch(v['time']) for v in w])
        assert np.all(np.diff(times) >= 0)
        assert abs(times[0] - epoch(assignment['takeoff_time'])) < .0011
        assert abs(times[-1] - epoch(assignment['landing_time'])) < .0011
        assert abs(times[-1]-times[0]-assignment['estimated_time']) < .002
        trajectory = np.column_stack([xy, z])
        trajectories.append((times, trajectory))
        sortie_times.setdefault(u['id'], []).append((times[0], times[-1]))
        lengths = np.linalg.norm(np.diff(trajectory, axis=0), axis=1)
        assert abs(lengths.sum()-assignment['estimated_distance']) < .005
        _, _, horizontal_geodesic = GEOD.inv(coords[:-1,0], coords[:-1,1], coords[1:,0], coords[1:,1])
        geodesic_length = np.hypot(horizontal_geodesic, np.diff(z)).sum()
        assert geodesic_length <= ut['max_flight_distance'] + .01
        assert assignment['estimated_distance'] * 1.02 <= ut['max_flight_distance'] + .01
        _, _, from_home = GEOD.inv(np.full(len(coords), coords[0,0]), np.full(len(coords), coords[0,1]), coords[:,0], coords[:,1])
        assert from_home.max() <= ut['max_distance_from_home'] + .01
        assert z.min() >= 0 and z.max() <= ut['max_alt'] + 1e-6
        assert abs(assignment['battery_usage']-assignment['estimated_distance']/ut['max_flight_distance']*100) < 1e-7
        endurance = float(os.environ.get('PLANNER_MAX_FLIGHT_TIME_SECONDS', '0'))
        if endurance:
            assert assignment['estimated_time']*1.02 <= endurance+.01
        for i in range(1, len(w)):
            segment = LineString([xy[i-1], xy[i]])
            if segment.length > 1e-7:
                assert len(tree.query(segment, predicate='intersects')) == 0, 'NFZ/hole intersection'
            else:
                assert len(tree.query(Point(xy[i]), predicate='intersects')) == 0
            elapsed = times[i]-times[i-1]
            assert abs(z[i]-z[i-1]) <= (ut['climb_speed'] if z[i]>=z[i-1] else ut['descent_speed'])*(elapsed+.002)+.005
            assert segment.length <= ut['max_speed']*(elapsed+.002)+.005
            if ut['min_speed'] > 0 and elapsed > .01:
                assert segment.length+.1 >= ut['min_speed']*(elapsed-.002)
            if w[i-1]['action'] == 'line_begin':
                assert w[i]['action'] == 'line_end'
                assert survey.buffer(.0001).covers(segment), 'survey leaves shell or enters hole'
                height = w[i-1]['altitude']
                assert height >= ut['min_alt']-1e-6
                for axis in ['X', 'Y']:
                    actual_gsd = 100*height*cam['matrix'+axis]/cam['focalLength']/cam['matrixPix'+axis]
                    assert actual_gsd <= request['gsd'] + 1e-7
                assert 0 < w[i-1]['photo_distance'] <= height*cam['matrixY']/cam['focalLength']*.5 + 1e-7
                # Camera footprint swept along a straight line, exact for cardinal tracks.
                half_width = height*cam['matrixX']/cam['focalLength']/2
                half_length = height*cam['matrixY']/cam['focalLength']/2
                dx, dy = xy[i]-xy[i-1]
                ex, ey = (half_length, half_width) if abs(dx)>abs(dy) else (half_width,half_length)
                all_footprints.append(box(min(xy[i-1,0],xy[i,0])-ex,min(xy[i-1,1],xy[i,1])-ey,
                                          max(xy[i-1,0],xy[i,0])+ex,max(xy[i-1,1],xy[i,1])+ey))
        if ut['min_turn_radius'] > 0:
            # Circumradius of successive distinct polyline points detects sharp turns.
            distinct = [xy[0]]
            for p in xy[1:]:
                if np.linalg.norm(p-distinct[-1]) > 1e-5:
                    distinct.append(p)
            for a,b,c in zip(distinct,distinct[1:],distinct[2:]):
                ab,bc,ac = np.linalg.norm(b-a),np.linalg.norm(c-b),np.linalg.norm(c-a)
                cross = abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))
                if cross > 1e-7:
                    radius = ab*bc*ac/(2*cross)
                    assert radius >= ut['min_turn_radius']*.99, f'turn radius {radius}'
        total_distance += assignment['estimated_distance']
    assert trajectories
    for i, a in enumerate(trajectories):
        for b in trajectories[:i]:
            assert closest_approach(a,b) >= 29.9, 'space-time conflict'
    turnaround = float(os.environ.get('PLANNER_TURNAROUND_SECONDS', '300'))
    for flights in sortie_times.values():
        flights.sort()
        for prev, nxt in zip(flights,flights[1:]):
            assert nxt[0] >= prev[1]+turnaround-.002
    s = result['summary']
    assert abs(s['total_distance']-total_distance) < .001
    assert s['uavs_total'] == len(uavs) and s['uavs_used'] == len(sortie_times)
    begin,end = min(t[0][0] for t in trajectories),max(t[0][-1] for t in trajectories)
    assert abs(epoch(s['operation_start'])-begin) < .002
    assert abs(epoch(s['operation_end'])-end) < .002
    assert abs(s['total_time']-(end-begin)) < .002
    if request.get('operation_end_time'):
        assert end <= epoch(request['operation_end_time'])+.002
    covered = unary_union(all_footprints)
    return {'sorties':len(trajectories),'uavs_used':len(sortie_times),
            'waypoints':sum(len(t[0]) for t in trajectories),
            'distance_m':round(total_distance,2), 'mission_seconds':round(s['total_time'],2),
            'requested_area_km2':round(survey.area/1e6,4),
            'footprint_coverage_fraction':round(survey.intersection(covered).area/survey.area,5)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--library', default=ROOT/'build/libplanner.so')
    parser.add_argument('--report', default=ROOT/'tests/validation_report.json')
    parser.add_argument('--generated-dir', type=Path, default=ROOT/'tests/generated')
    args = parser.parse_args()
    original_sources = source_snapshot()
    abi = ABI(args.library)
    official = json.loads((ROOT/'no-fly-zons/no_fly_zones.json').read_text())
    base = json.loads((ROOT/'tests/smoke_request.json').read_text())
    report = []
    generated = args.generated_dir
    generated.mkdir(parents=True, exist_ok=True)
    synthetic = copy.deepcopy(official)
    synthetic['zones'] += [
        {'type':'polygon','coordinates':[[44.998,10.004],[45.003,10.004],[45.003,10.006],[44.998,10.006],[44.998,10.004]]},
        {'type':'circle','center':[45.0055,10.009], 'radius_km':.09}]
    (generated/'zones.json').write_text(json.dumps(synthetic))

    def run(name, request, error=False, zones=None, assertions=None, **env):
        if zones is not None:
            (generated/'zones.json').write_text(json.dumps(zones))
            env['PLANNER_NO_FLY_ZONES'] = generated/'zones.json'
        else:
            env.setdefault('PLANNER_NO_FLY_ZONES', None)
        t = time.monotonic()
        with environment(**env):
            response = abi.call(request)
            planning_seconds=time.monotonic()-t
            if error:
                assert set(response)=={'error'} and isinstance(response['error'],str), (name,response)
                metrics = {'expected_error':response['error']}
            else:
                metrics = validate(request,response,zones or official)
                if assertions:
                    assertions(response,metrics)
        elapsed=time.monotonic()-t
        item={'name':name,'status':'PASS','planning_seconds':round(planning_seconds,4),'elapsed_seconds':round(elapsed,3),**metrics}
        report.append(item)
        print(json.dumps(item,ensure_ascii=False),flush=True)
        if isinstance(request,dict):
            (generated/(name+'_request.json')).write_text(json.dumps(request,indent=2))
        (generated/(name+'_response.json')).write_text(json.dumps(response))
        return response

    run('simple',base,assertions=lambda r,m: require(m['footprint_coverage_fraction']>.999))
    hole=copy.deepcopy(base)
    hole['survey_area']['coordinates'].append([[10.004,45.002],[10.007,45.002],[10.007,45.005],[10.004,45.005],[10.004,45.002]])
    run('holes',hole)
    concave=copy.deepcopy(base)
    concave['survey_area']['coordinates']=[[[10,45],[10.012,45],[10.012,45.003],[10.004,45.003],[10.004,45.008],[10,45.008],[10,45]]]
    run('concave_polygon',concave,assertions=lambda r,m: require(m['footprint_coverage_fraction']>.99))
    clockwise=copy.deepcopy(base)
    clockwise['survey_area']['coordinates'][0].reverse()
    run('clockwise_polygon',clockwise)
    overlapping=copy.deepcopy(synthetic)
    overlapping['zones'].append({'type':'circle','center':[45.002,10.005], 'radius_km':.16})
    run('overlapping_nfz',base,zones=overlapping)
    outside=copy.deepcopy(base)
    outside['survey_area']['coordinates'].append([[11,45],[11.01,45],[11.01,45.01],[11,45.01],[11,45]])
    run('hole_outside_shell',outside,error=True)
    run('polygon_and_circle_nfz',base,zones=synthetic)
    multi=copy.deepcopy(base);multi['survey_area']={'type':'MultiPolygon','coordinates':[base['survey_area']['coordinates'],[[[10.02,45],[10.026,45],[10.026,45.004],[10.02,45.004],[10.02,45]]]]}
    run('multipolygon_c_abi',multi)
    fleet=copy.deepcopy(base);fleet['optimization_criteria']='min_time';fleet['uavs']=[dict(base['uavs'][0],id='uav'+str(i)) for i in range(4)]
    run('four_uavs',fleet,assertions=lambda r,m: require(m['uavs_used']>=2))
    sorties=copy.deepcopy(base);sorties['uav_types'][1]['max_flight_distance']=5000
    run('multiple_sorties',sorties,assertions=lambda r,m: require(m['sorties']>=2))
    wing=copy.deepcopy(base);wing['uavs']=[{'id':'wing1','type_id':'geoscan_201','camera_id':'riebo_r4'}]
    run('fixed_wing_turn_radius',wing)
    # Positive endurance-config test and negative endurance test.
    run('flight_time_limit_success',base,PLANNER_MAX_FLIGHT_TIME_SECONDS=1000)
    run('flight_time_limit_rejection',base,error=True,PLANNER_MAX_FLIGHT_TIME_SECONDS=30)
    for name, edit in [
        ('range_infeasible',lambda r:r['uav_types'][1].update(max_flight_distance=100)),
        ('home_radius_infeasible',lambda r:r['uav_types'][1].update(max_distance_from_home=10)),
        ('invalid_reference',lambda r:r['uavs'][0].update(camera_id='missing')),
        ('gsd_altitude_infeasible',lambda r:r.update(gsd=.1)),
        ('missing_gsd',lambda r:r.pop('gsd')),
        ('invalid_date',lambda r:r.update(operation_start_time='2026-02-30T12:00:00Z')),
        ('operation_window_infeasible',lambda r:r.update(operation_end_time='2026-10-20T07:25:01Z')),
        ('lidar_api_unsupported',lambda r:r.update(survey_type='LiDAR')),
        ('duplicate_uav',lambda r:r['uavs'].append(copy.deepcopy(r['uavs'][0]))),
        ('self_intersection',lambda r:r['survey_area'].update(coordinates=[[[10,45],[10.01,45.01],[10,45.01],[10.01,45],[10,45]]]))]:
        case=copy.deepcopy(base);edit(case);run(name,case,error=True)
    inside=copy.deepcopy(base);inside['start_points'][0]['coordinates']=[10.005,45]
    run('start_inside_nfz',inside,error=True,zones=synthetic)
    run('missing_explicit_zone_file',base,error=True,PLANNER_NO_FLY_ZONES=str(ROOT/'tests/does-not-exist.json'))
    run('null_pointer',None,error=True)
    run('malformed_json',b'{',error=True)
    run('overflow_json',b'{"gsd":1e400}',error=True)
    run('nan_json',b'{"gsd":NaN}',error=True)
    offset=copy.deepcopy(base);offset['operation_start_time']='2026-10-20T10:25:00+03:00'
    same=run('timezone_offset',offset)
    assert same['summary']['operation_start']=='2026-10-20T07:25:00.000Z'
    # Fixtures without GSD must fail; otherwise validate their original request.
    # Then exercise each geometry with explicit test gsd=3.
    for path in sorted((ROOT/'test-data').glob('*.json')):
        request=json.loads(path.read_text())
        run('original_'+path.stem,request,error='gsd' not in request)
        request['gsd']=3
        expected_failures={'area_too_large','lots_of_holes','start_from_no_fly_zone','start_too_far','unreachable_area'}
        run('gsd3_'+path.stem,request,error=path.stem in expected_failures)
    large=copy.deepcopy(base);large['survey_area']['coordinates']=[[[10,45],[10.12683,45],[10.12683,45.09],[10,45.09],[10,45]]]
    large['uavs']=[dict(base['uavs'][0],id='large'+str(i)) for i in range(10)]
    large['gsd']=5;large['optimization_criteria']='min_time'
    large['uav_types'][1].update(max_flight_distance=60000,max_distance_from_home=25000)
    run('100km2_ten_uavs',large,assertions=lambda r,m: require(m['uavs_used']==10 and m['footprint_coverage_fraction']>.999))
    large_zones=copy.deepcopy(synthetic)
    large_zones['zones'].extend([
        {'type':'circle','center':[45.045,10.075], 'radius_km':.5},
        {'type':'polygon','coordinates':[[45.02,10.04],[45.06,10.04],[45.06,10.05],[45.02,10.05],[45.02,10.04]]}])
    run('100km2_ten_uavs_with_nfz',large,zones=large_zones,
        assertions=lambda r,m: require(m['uavs_used']==10 and m['sorties']>=10))
    # Reentrant ABI: no global mutable request or schedule state.
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda _:abi.call(base),range(8)))
    assert all(x==results[0] for x in results)
    report.append({'name':'concurrency_determinism','status':'PASS','calls':8})
    abi.lib.free_string(None)
    assert (ROOT/'no-fly-zons/no_fly_zones.json').read_bytes()==(ROOT.parent/'frontend/src/data/no_fly_zones.json').read_bytes()
    assert source_snapshot()==original_sources, 'application sources were changed during validation'
    report.append({'name':'readonly_integrity','status':'PASS','files':len(original_sources)})
    Path(args.report).write_text(json.dumps(report,indent=2,ensure_ascii=False))
    print(f'PASS: {len(report)} checks; report: {args.report}')


def require(condition):
    assert condition


if __name__=='__main__':
    main()
