@echo off
rem Double Control Test Script
rem This script demonstrates the double control system

echo =============================
echo Double Control Test
rem =============================

echo.
echo Step 1: Ensure browser-harness is installed and Chrome is running with CDP
call browser-harness doctor

echo.
echo Step 2: Test browser-harness control
echo Getting current tabs...
browser-harness <<'PY'
print("Active tabs:", list_tabs())
PY

echo.
echo Step 3: Open a new tab via browser-harness
echo Opening example.com...
browser-harness <<'PY'
new_tab("https://example.com")
print("New tab opened:", page_info())
PY

echo.
echo Step 4: List all tabs again
echo Current tabs...
browser-harness <<'PY'
for tab in list_tabs():
    print(f"  - {tab.get('title')} ({'ACTIVE' if tab.get('active') else 'inactive'})")
PY

echo.
echo =============================
echo Double Control Test Complete!
echo browser-harness: External control via CDP
rem Chrome Extension: In-browser UI and API
rem =============================
