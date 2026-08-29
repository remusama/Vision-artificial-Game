@echo off
title Subir proyecto a GitHub
echo ===================================================
echo     CONFIGURACION Y SUBIDA DE PROYECTO A GITHUB
echo ===================================================
echo.

:: Verificar si git esta instalado
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Git no esta instalado o no se encuentra en el PATH.
    echo Intentando instalar Git usando winget...
    echo.
    winget install --id Git.Git --exact --source winget
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] No se pudo instalar Git automaticamente.
        echo Por favor, descarga e instala Git manualmente desde: https://git-scm.com/
        echo Despues de instalarlo, abre una nueva ventana de terminal y vuelve a ejecutar este script.
        echo.
        pause
        exit /b
    )
    echo.
    echo [OK] Git se ha instalado con exito.
    echo IMPORTANTE: Cierra esta ventana y vuelve a ejecutar el script para que el sistema reconozca a Git.
    echo.
    pause
    exit /b
)

:: Inicializar git si no esta inicializado
if not exist .git (
    echo Inicializando repositorio Git local...
    git init
)

:: Configurar .gitignore por si acaso
if not exist .gitignore (
    echo Creando un archivo .gitignore basico...
    echo node_modules/ > .gitignore
    echo .next/ >> .gitignore
    echo out/ >> .gitignore
    echo build/ >> .gitignore
    echo dist/ >> .gitignore
    echo .env* >> .gitignore
    echo .DS_Store >> .gitignore
)

:: Verificar y configurar identidad si no existe
git config user.email >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Tu identidad de Git no esta configurada en esta computadora.
    echo Por favor, introduce tus datos para poder hacer commits:
    echo.
    set /p gitname="1. Introduce tu nombre (ej. Juan Perez): "
    set /p gitemail="2. Introduce tu correo de GitHub (ej. tu_correo@ejemplo.com): "
    
    git config --global user.name "%gitname%"
    git config --global user.email "%gitemail%"
    echo.
    echo [OK] Identidad configurada con exito.
    echo.
)

:: Agregar y confirmar archivos
echo.
echo Preparando archivos del proyecto...
git add .
git commit -m "Initial commit: Proyecto Base"
git branch -M main

echo.
echo Como deseas conectar y subir tu proyecto a GitHub?
echo [1] Usar Git estandar (Requiere haber creado el repositorio en github.com antes)
echo [2] Usar GitHub CLI (Crea el repositorio en tu cuenta automaticamente)
echo.
set /p opcion="Selecciona una opcion (1 o 2) y presiona ENTER: "

if "%opcion%"=="1" goto OPCION_1
if "%opcion%"=="2" goto OPCION_2
echo Opcion no valida. Saliendo...
pause
exit /b

:OPCION_1
echo.
set /p git_user="1. Introduce tu nombre de usuario de GitHub: "
set /p git_repo="2. Introduce el nombre del repositorio (ej. PROYECT): "

echo.
echo Conectando con el repositorio remoto...
git remote remove origin >nul 2>nul
git remote add origin https://github.com/%git_user%/%git_repo%.git

echo.
echo ===============================================================
echo A continuacion, se abrira una ventana emergente para que
echo inicies sesion con tu cuenta de GitHub de forma segura.
echo ===============================================================
echo.
git push -u origin main
goto FIN

:OPCION_2
echo.
:: Verificar si gh cli esta instalado
where gh >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] GitHub CLI no esta instalado. Intentando instalarlo...
    winget install --id GitHub.cli --exact --source winget
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] No se pudo instalar GitHub CLI. Por favor, usa la Opcion 1.
        echo.
        pause
        exit /b
    )
    echo.
    echo [OK] GitHub CLI se ha instalado con exito.
    echo IMPORTANTE: Cierra esta ventana y vuelve a ejecutar el script para usar esta opcion.
    echo.
    pause
    exit /b
)

echo Iniciando sesion en GitHub...
gh auth login

echo.
set /p git_repo="Introduce el nombre que deseas darle a tu nuevo repositorio: "
echo Creando repositorio en tu GitHub y subiendo el codigo...
gh repo create %git_repo% --public --source=. --remote=origin --push
goto FIN

:FIN
echo.
echo ===================================================
echo Proceso finalizado!
echo ===================================================
echo.
pause
