@echo off
setlocal enabledelayedexpansion
title Control de PC por Gestos (Local)
cd /d "%~dp0"

:: --- LIBERAR PUERTO NEXT.JS SI ESTÁ EN USO ---
echo [INFO] Liberando puerto 3000 (Next.js) si esta ocupado...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /F /PID %%a >nul 2>&1
)

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] No se encontro el entorno virtual .venv.
    echo Por favor, ejecuta primero "instalar.bat" para configurar todo automaticamente.
    echo.
    pause
    exit /b 1
)

:: --- INICIAR FRONTEND NEXT.JS Y CONVEX EN SEGUNDO PLANO ---
echo [INFO] Detectando Node.js para lanzar la interfaz web...
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js detectado. Iniciando frontend y base de datos local...
    
    :: Iniciar Convex de forma paralela y no bloqueante
    start "Convex Backend" cmd /k "cd /d ..\app\PROYECT\gesture-control-interface && npx convex dev"
    
    where pnpm >nul 2>&1
    if !errorlevel! equ 0 (
        start "Next.js Frontend" cmd /k "cd /d ..\app\PROYECT\gesture-control-interface && pnpm run dev"
    ) else (
        start "Next.js Frontend" cmd /k "cd /d ..\app\PROYECT\gesture-control-interface && npm run dev"
    )
) else (
    echo [ADVERTENCIA] Node.js no esta instalado. No se iniciara la interfaz web.
)
echo.

echo ==============================================================
echo   INICIANDO VISION ARTIFICIAL POR GESTOS
echo ==============================================================
echo.
".venv\Scripts\python.exe" app_gestures.py

echo.
echo Programa finalizado.
pause
