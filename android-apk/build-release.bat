@echo off
echo ===================================================
echo   AETHER: ECLIPSE - SIGNIERTER RELEASE-BUILD
echo ===================================================
cd /d "%~dp0"
if not exist "keystore.properties" (
  echo keystore.properties fehlt. Bitte zuerst create-keystore.bat ausfuehren.
  pause
  exit /b 1
)

cd /d "%~dp0\.."
echo [1/4] Baue Web-App (Vite)...
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%

cd /d "%~dp0"
echo [2/4] Synchronisiere mit Android-Projekt...
call npx cap sync android
if %errorlevel% neq 0 exit /b %errorlevel%

cd /d "%~dp0\android"
echo [3/4] Baue signiertes App-Bundle (AAB fuer Google Play)...
call gradlew.bat bundleRelease
if %errorlevel% neq 0 exit /b %errorlevel%

echo [4/4] Baue signierte Release-APK (zum direkten Installieren)...
call gradlew.bat assembleRelease
if %errorlevel% neq 0 exit /b %errorlevel%

copy /Y "app\build\outputs\bundle\release\app-release.aab" "%~dp0\Aether-Eclipse-Release.aab" >nul
copy /Y "app\build\outputs\apk\release\app-release.apk" "%~dp0\Aether-Eclipse-Release.apk" >nul
echo.
echo ===================================================
echo   FERTIG!
echo   Play Store:  %~dp0Aether-Eclipse-Release.aab
echo   Direkt:      %~dp0Aether-Eclipse-Release.apk
echo ===================================================
pause
