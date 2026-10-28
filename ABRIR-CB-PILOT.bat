@echo off
chcp 65001 >nul
title CB Pilot - vista en tu computadora
cd /d "%~dp0"
echo.
echo  ==============================================
echo    CB Pilot - vista en tu computadora
echo  ==============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  Falta instalar Node.js (es gratis y se hace una sola vez^).
  echo  Se va a abrir la pagina de descarga: elegi la version "LTS",
  echo  instalala con "Siguiente, Siguiente..." y despues volve a abrir este archivo.
  start "" https://nodejs.org/es/download
  pause
  exit /b 1
)
if not exist node_modules (
  echo  Preparando por primera vez (tarda un minuto^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 ( echo  No se pudo instalar. Revisa tu internet. & pause & exit /b 1 )
)
echo.
echo  Para usar la IA REAL pega tu clave de Anthropic (empieza con sk-ant-^).
echo  Para solo ver el diseno con respuestas simuladas, toca ENTER sin escribir nada.
set "ANTHROPIC_API_KEY="
set /p "ANTHROPIC_API_KEY=  Clave (opcional): "
if "%ANTHROPIC_API_KEY%"=="" ( set "PILOT_FAKE=1" & echo  Modo simulado: no gasta nada. ) else ( set "PILOT_FAKE=" & echo  Modo IA real: cada mensaje gasta un poco de tu saldo. )
set "ADMIN_SETUP_CODE=codigo-local-123"
set "PILOT_DEADLINE_MS=600000"
echo.
echo  Chat:   http://localhost:8899
echo  Panel:  http://localhost:8899/admin/   (codigo de configuracion: codigo-local-123^)
echo  Para cerrar CB Pilot, cerra esta ventana.
echo  Lo que hagas aqui se borra al cerrar (es solo para probar^).
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8899"
node tests\servidor-local.mjs 8899
pause
