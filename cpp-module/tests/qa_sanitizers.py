"""Run existing sanitizer suite while preserving historical reports."""
from pathlib import Path
import os
source_path = Path(__file__).with_name('sanitizers.py')
source = source_path.read_text().replace('build-sanitized/planner_test', 'build-qa-sanitized/planner_test')
output = os.environ.get('QA_OUTPUT', 'tests/qa-2026-10-04')
source = source.replace('tests/generated', output + '/generated')
source = source.replace('tests/sanitizer_report.json', output + '/sanitizers.json')
exec(compile(source, str(source_path), 'exec'), {'__file__': str(source_path), '__name__': '__main__'})
