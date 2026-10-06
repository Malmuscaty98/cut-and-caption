@echo off
rem Cut & Caption launcher for Windows cmd / PowerShell (Claude Code itself uses bin/cut-and-caption via Git Bash).
setlocal
set "ROOT=%~dp0.."
if not defined CUTCAPTION_DATA if defined CLAUDE_PLUGIN_DATA set "CUTCAPTION_DATA=%CLAUDE_PLUGIN_DATA%"
if not defined CUTCAPTION_DATA set "CUTCAPTION_DATA=%USERPROFILE%\.cut-and-caption"
if not exist "%CUTCAPTION_DATA%" mkdir "%CUTCAPTION_DATA%"
set "UV_PROJECT_ENVIRONMENT=%CUTCAPTION_DATA%\venv"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
where uv >nul 2>nul || (echo uv is not installed. Install it with: powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex" & exit /b 127)
uv run --quiet --project "%ROOT%\engine" --frozen python "%ROOT%\engine\run.py" %*
