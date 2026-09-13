#!/usr/bin/env python3
"""Compatibility entry point. Run using Blender, which includes NumPy.
blender -b --python assets/encounters/generate_encounters.py
"""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('build_blender.py')),run_name='__main__')
