@echo off
REM Cleanup script for Terminus Electron instances on Windows
REM This script kills all running Electron and Node processes related to Terminus

echo 🧹 Cleaning up Terminus processes...

REM Kill Electron processes
echo Checking for Electron processes...
tasklist /FI "IMAGENAME eq electron.exe" 2>NUL | find /I /N "electron.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Found Electron processes, terminating...
    taskkill /F /IM electron.exe >NUL 2>&1
    echo ✅ Electron processes terminated
) else (
    echo ℹ️  No Electron processes found
)

REM Kill Node processes
echo Checking for Node processes...
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Found Node processes, terminating...
    taskkill /F /IM node.exe >NUL 2>&1
    echo ✅ Node processes terminated
) else (
    echo ℹ️  No Node processes found
)

REM Check if port 30003 is in use
echo Checking port 30003...
netstat -ano | findstr :30003 >NUL
if "%ERRORLEVEL%"=="0" (
    echo ⚠️  Port 30003 is in use, attempting to free...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :30003') do taskkill /F /PID %%a >NUL 2>&1
    echo ✅ Port 30003 freed
) else (
    echo ℹ️  Port 30003 is free
)

echo ✨ Cleanup complete!
pause
