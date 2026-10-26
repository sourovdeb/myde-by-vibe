#!/usr/bin/env python3
"""Wrapper: Run resolve_bridge.py with Resolve's bundled Python."""
import subprocess, sys, os

RESOLVE_PYTHON = r"C:\Program Files\Blackmagic Design\DaVinci Resolve\ResolvePython\ResolvePython.exe"
BRIDGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resolve_bridge.py")

args = [RESOLVE_PYTHON, BRIDGE] + sys.argv[1:]
result = subprocess.run(args, capture_output=True, text=True)
sys.stdout.write(result.stdout)
if result.stderr:
    sys.stderr.write(result.stderr)
sys.exit(result.returncode)
