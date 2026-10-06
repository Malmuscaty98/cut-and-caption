@echo off
rem Qass launcher for Windows cmd / PowerShell (Claude Code itself uses bin/qass via Git Bash).
setlocal
set "ROOT=%~dp0.."
if not defined QASS_DATA if defined CLAUDE_PLUGIN_DATA set "QASS_DATA=%CLAUDE_PLUGIN_DATA%"
if not defined QASS_DATA set "QASS_DATA=%USERPROFILE%\.qass"
if not exist "%QASS_DATA%" mkdir "%QASS_DATA%"
set "UV_PROJECT_ENVIRONMENT=%QASS_DATA%\venv"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
where uv >nul 2>nul || (echo uv is not installed. Install it with: powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex" & exit /b 127)
uv run --quiet --project "%ROOT%\engine" --frozen python "%ROOT%\engine\run.py" %*
