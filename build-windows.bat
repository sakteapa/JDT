@echo off
title Building SAE J2534 UDS ECU Diagnostic Suite (.exe / .msi)
echo ===============================================================================
echo   Building SAE J2534 UDS ECU Diagnostic ^& Calibration Suite for Windows
echo ===============================================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Check Rust / Cargo
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Rust / Cargo is not installed! Please install Rust from https://rustup.rs
    pause
    exit /b 1
)

echo [1/3] Installing NPM dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Building Web Frontend assets...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Compiling Tauri native Windows .exe and .msi installer...
call npm run tauri build
if %errorlevel% neq 0 (
    echo [ERROR] Tauri build failed!
    pause
    exit /b 1
)

echo.
echo ===============================================================================
echo   BUILD SUCCESSFUL!
echo ===============================================================================
echo   Your compiled Windows application is located at:
echo     src-tauri\target\release\ECU UDS J2534 Flasher.exe
echo   Your Windows installer is located at:
echo     src-tauri\target\release\bundle\msi\
echo ===============================================================================
echo.
pause
