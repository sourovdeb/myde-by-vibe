@echo off
rem Build Unified MCP Gateway as a single .exe using Node SEA
rem Requires: Node.js >= 20, postject (npm install -g postject)

cd /d "%~dp0"

echo [1/4] Generating SEA blob...
node --experimental-sea-config sea-config.json
if errorlevel 1 exit /b 1

echo [2/4] Copying node.exe to gateway.exe...
node -e "require('fs').copyFileSync(process.execPath, 'gateway.exe')"
if errorlevel 1 exit /b 1

echo [3/4] Injecting SEA blob into gateway.exe...
npx postject gateway.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if errorlevel 1 exit /b 1

echo [4/4] Cleaning up...
del sea-prep.blob 2>nul

echo.
echo Build complete: gateway.exe
for %%A in (gateway.exe) do echo Size: %%~zA bytes
exit /b 0
