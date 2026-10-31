@echo off
setlocal
echo ===================================================
echo   AETHER: ECLIPSE - RELEASE-SCHLUESSEL ERSTELLEN
echo ===================================================
echo.
echo Einmalig ausfuehren. Den Schluessel (aether-release.jks) und das
echo Passwort SICHER AUFBEWAHREN - ohne sie kannst du im Play Store
echo keine Updates mehr veroeffentlichen!
echo.
cd /d "%~dp0"

if exist "aether-release.jks" (
  echo aether-release.jks existiert bereits - Abbruch, um ihn nicht zu ueberschreiben.
  pause
  exit /b 1
)

set "KEYTOOL=keytool"
if defined JAVA_HOME set "KEYTOOL=%JAVA_HOME%\bin\keytool"

set /p STOREPASS=Passwort fuer den Schluessel (mind. 6 Zeichen):

"%KEYTOOL%" -genkeypair -v -keystore aether-release.jks -alias aether -keyalg RSA -keysize 2048 -validity 10000 -storepass "%STOREPASS%" -keypass "%STOREPASS%" -dname "CN=Aether Eclipse, O=Aether Eclipse, C=DE"
if %errorlevel% neq 0 (
  echo.
  echo keytool fehlgeschlagen. Ist ein JDK installiert bzw. JAVA_HOME gesetzt?
  pause
  exit /b 1
)

(
  echo storeFile=aether-release.jks
  echo storePassword=%STOREPASS%
  echo keyAlias=aether
  echo keyPassword=%STOREPASS%
) > keystore.properties

echo.
echo Fertig! aether-release.jks und keystore.properties wurden erstellt.
echo Beide Dateien sind per .gitignore vom Git-Repository ausgeschlossen.
pause
