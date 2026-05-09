@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo Thai Word Fixer - Local Server
echo ========================================
echo.

if not exist ".venv\" (
    echo [setup] Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo Failed to create venv. Make sure Python is installed.
        pause
        exit /b 1
    )
)

call .venv\Scripts\activate.bat

echo [setup] Installing dependencies...
pip install -q -r requirements.txt
if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo [run] Starting server at http://127.0.0.1:5000
echo Press Ctrl+C to stop.
echo.

start "" http://127.0.0.1:5000
python app.py

pause
