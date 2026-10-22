@echo off
:: Restores v1_2026-09-17_initial.db to the Badachuli Rice Mill database on Windows.
:: Close the app before running this, then restart it afterward.

set TARGET=%APPDATA%\Badachuli Rice Mill\badachuli.db
set SNAPSHOT=%~dp0v1_2026-09-17_initial.db

if not exist "%APPDATA%\Badachuli Rice Mill" (
    mkdir "%APPDATA%\Badachuli Rice Mill"
)

echo Restoring database from v1_2026-09-17_initial.db ...
copy /Y "%SNAPSHOT%" "%TARGET%"
if %errorlevel% == 0 (
    echo Done! Restart the Badachuli Rice Mill app.
) else (
    echo ERROR: Could not copy file. Make sure the app is closed.
)
pause
