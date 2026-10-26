@echo off
cd /d E:\tools\sourov-control-center

REM Build Sourov Control Center .exe with PyInstaller
REM --windowed = no console window
REM --onefile = single .exe
REM --add-data = include index.html

pyinstaller ^
  --name "Sourov Control Center" ^
  --windowed ^
  --onefile ^
  --clean ^
  --noconfirm ^
  --add-data "index.html;." ^
  --hidden-import webview ^
  --hidden-import webview.platforms.winforms ^
  --hidden-import pythonnet ^
  --hidden-import clr_loader ^
  --icon=NONE ^
  app.py

echo.
echo Build complete. Output: dist\Sourov Control Center.exe
echo.
pause
