#!/usr/bin/env python3
"""Wrapper: Run obs_bridge.py with the latch-bridges venv Python."""
import subprocess, sys, os

VENV_PYTHON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "venv", "Scripts", "python.exe")
BRIDGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "obs_bridge.py")

args = [VENV_PYTHON, BRIDGE] + sys.argv[1:]
result = subprocess.run(args, capture_output=True, text=True)
sys.stdout.write(result.stdout)
if result.stderr:
    sys.stderr.write(result.stderr)
sys.exit(result.returncode)
