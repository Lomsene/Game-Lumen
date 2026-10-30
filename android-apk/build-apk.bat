@echo off
echo ===================================================
echo   AETHER: ECLIPSE - ANDROID APK BUILDER (LANDSCAPE)
echo ===================================================
cd /d "%~dp0\.."
echo [1/3] Pruefe Typen und baue Web-App (Vite)...
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%

cd /d "%~dp0"
echo [2/3] Synchronisiere mit Android-Projekt...
call npx cap sync android
if %errorlevel% neq 0 exit /b %errorlevel%

cd /d "%~dp0\android"
echo [3/3] Kompiliere Android APK (Gradle)...
call gradlew.bat assembleDebug
if %errorlevel% neq 0 exit /b %errorlevel%

copy /Y "app\build\outputs\apk\debug\app-debug.apk" "%~dp0\Aether-Eclipse-Landscape.apk" >nul
echo.
echo ===================================================
echo   FERTIG! Deine APK liegt bereit unter:
echo   %~dp0\Aether-Eclipse-Landscape.apk
echo ===================================================
pause

