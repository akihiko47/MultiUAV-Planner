"""Run acceptance checks without overwriting historical evidence."""
from pathlib import Path
import os
import runpy
import sys

source_path = Path(__file__).with_name('validate.py')
output = Path(os.environ.get('QA_OUTPUT', source_path.parent / 'qa-2026-10-04'))
output.mkdir(exist_ok=True)
sys.argv = [str(source_path), '--library', str(source_path.parents[1] / 'build-qa/libplanner.so'), '--report', str(output / 'acceptance.json'), '--generated-dir', str(output / 'generated')]
runpy.run_path(str(source_path), run_name='__main__')
