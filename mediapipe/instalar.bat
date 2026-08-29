@echo off
setlocal enabledelayedexpansion
title Instalador de Control de PC por Gestos

echo ==============================================================
echo   INSTALADOR DE CONTROL DE PC POR GESTOS (MEDIAPIPE)
echo ==============================================================
echo.

:: 1. Verificar si Python está instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no está instalado o no se encuentra en el PATH.
    echo Por favor, descarga e instala Python (version recomendada: 3.10 a 3.12) desde:
    echo https://www.python.org/downloads/
    echo.
    echo IMPORTANTE: Asegurate de marcar la casilla "Add Python to PATH" durante la instalacion.
    echo.
    pause
    exit /b 1
)

:: Mostrar versión de Python encontrada
for /f "tokens=2" %%v in ('python --version') do set PY_VERSION=%%v
echo [OK] Python detectado: %PY_VERSION%
echo.

:: 2. Crear entorno virtual (.venv)
if not exist ".venv" (
    echo [INFO] Creando entorno virtual (.venv)...
    python -m venv .venv
    if !errorlevel! neq 0 (
        echo [ERROR] No se pudo crear el entorno virtual.
        pause
        exit /b 1
    )
    echo [OK] Entorno virtual creado con exito.
) else (
    echo [INFO] El entorno virtual (.venv) ya existe. Saltando paso.
)
echo.

:: 3. Activar entorno virtual e instalar dependencias
echo [INFO] Activando entorno virtual...
call .venv\Scripts\activate.bat
if !errorlevel! neq 0 (
    echo [ERROR] No se pudo activar el entorno virtual.
    pause
    exit /b 1
)
echo [OK] Entorno virtual activo.
echo.

echo [INFO] Actualizando pip e instalando dependencias (requirements.txt)...
echo Esto puede tomar unos minutos dependiendo de tu conexion a internet...
echo.

python -m pip install --upgrade pip
if !errorlevel! neq 0 (
    echo [ADVERTENCIA] No se pudo actualizar pip, continuando con la instalacion de paquetes...
)

pip install -r requirements.txt
if !errorlevel! neq 0 (
    echo.
    echo [ERROR] Hubo un problema al instalar las dependencias de requirements.txt.
    echo Por favor, revisa tu conexion a internet e intentalo de nuevo.
    pause
    exit /b 1
)

:: --- INSTALAR DEPENDENCIAS DE LA INTERFAZ NEXT.JS SI NODE.JS EXISTE ---
echo.
echo [INFO] Detectando Node.js para instalar dependencias de la interfaz web...
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js detectado.
    
    where pnpm >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] pnpm detectado. Instalando dependencias en gesture-control-interface...
        cd /d "%~dp0..\app\PROYECT\gesture-control-interface"
        call pnpm install
    ) else (
        echo [INFO] pnpm no detectado. Instalando dependencias con npm install...
        cd /d "%~dp0..\app\PROYECT\gesture-control-interface"
        call npm install
    )
    cd /d "%~dp0"
) else (
    echo [ADVERTENCIA] Node.js no esta instalado. No se instalaron dependencias de la interfaz.
)

echo.
echo ==============================================================
echo   INSTALACION COMPLETADA CON EXITO
echo ==============================================================
echo.
echo Puedes iniciar la aplicacion ejecutando "iniciar.bat"
echo.
pause
