"""Client diagnostics must not hide internal/native response failures."""
import json
from pathlib import Path
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.main import app
from app.planner_client import PlannerError


class PlannerErrorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[2]
        cls.request = json.loads((root / 'cpp-module/tests/smoke_request.json').read_text())
        cls.client = TestClient(app)

    def test_client_diagnostics_are_422(self):
        for code in ['INVALID_REQUEST', 'INVALID_GEOMETRY', 'UNSUPPORTED_GEOGRAPHY', 'INFEASIBLE', 'RESOURCE_LIMIT']:
            with self.subTest(code=code), patch('app.main.call_planner', side_effect=PlannerError(f'{code}: diagnostic')):
                response = self.client.post('/v1/plan', json=self.request)
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json()['detail'], f'{code}: diagnostic')

    def test_internal_diagnostics_stay_500(self):
        for code in ['INTERNAL_ERROR', 'INTERNAL_VALIDATION', 'ZONE_DATA', 'UNKNOWN']:
            with self.subTest(code=code), patch('app.main.call_planner', side_effect=PlannerError(f'{code}: diagnostic')):
                self.assertEqual(self.client.post('/v1/plan', json=self.request).status_code, 500)

    def test_call_failure_stays_500(self):
        with patch('app.main.call_planner', side_effect=RuntimeError('native call failed')):
            self.assertEqual(self.client.post('/v1/plan', json=self.request).status_code, 500)

    def test_invalid_response_stays_502(self):
        with patch('app.main.call_planner', return_value={}):
            self.assertEqual(self.client.post('/v1/plan', json=self.request).status_code, 502)


if __name__ == '__main__':
    unittest.main()
