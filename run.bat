@echo off
setlocal
color 0b

echo ======================================================================
echo    SIMA - Sistema Inteligente de Monitoramento Academico
echo ======================================================================
echo.

:: Detectar ambiente virtual
IF EXIST ".venv\Scripts\python.exe" (
    SET PYTHON_EXE=".venv\Scripts\python.exe"
    echo [INFO] Utilizando ambiente virtual detectado (.venv)
) ELSE (
    SET PYTHON_EXE=python
    echo [WARN] Ambiente virtual .venv nao encontrado, utilizando Python global.
)

:: Terminal 1: Backend
echo [1/2] Iniciando API Backend (FastAPI na porta 8000)...
start "SIMA - Backend" cmd /k "title SIMA - API Backend && %PYTHON_EXE% -m uvicorn app.main:app --reload --port 8000"

:: Terminal 2: Frontend
echo [2/2] Iniciando Interface Frontend (Vite na porta 5173)...
start "SIMA - Frontend" cmd /k "title SIMA - Frontend Interface && cd frontend && npm install && npm run dev"

echo.
echo ======================================================================
echo   SISTEMA INICIADO COM SUCESSO!
echo.
echo   - Backend:  http://localhost:8000/docs
echo   - Frontend: http://localhost:5173
echo.
echo   Mantenha as janelas do terminal abertas para o sistema funcionar.
echo ======================================================================
echo.
pause
