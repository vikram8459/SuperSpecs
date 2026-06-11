: << 'CMDBLOCK'
@echo off
REM Cross-platform polyglot wrapper for hook scripts.
REM On Windows: cmd.exe runs the batch portion, which calls PowerShell on <name>.ps1.
REM On Unix:    bash interprets the rest of this file (: is a no-op in bash)
REM             and execs the extensionless <name> script.
REM
REM Usage: run-hook.cmd <script-name> [args...]
REM
REM Windows requirement: built-in Windows PowerShell (Win10+) at
REM   %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
REM or PowerShell 7+ (pwsh) on PATH. If neither is present we emit a
REM warning JSON envelope to stdout, a stderr line, and append to
REM %TEMP%\superspecs-hook.log, then exit non-zero.

if "%~1"=="" (
    echo superspecs: run-hook.cmd missing script name 1>&2
    exit /b 2
)

set "HOOK_DIR=%~dp0"
set "SCRIPT_NAME=%~1"
set "PS_SCRIPT=%HOOK_DIR%%SCRIPT_NAME%.ps1"

if not exist "%PS_SCRIPT%" (
    echo superspecs: missing PowerShell script "%PS_SCRIPT%" 1>&2
    exit /b 3
)

REM 1) Built-in Windows PowerShell (always present on Win10+).
set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%PS_EXE%" (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

REM 2) PowerShell 7+ on PATH (optional fallback).
where pwsh >nul 2>nul
if %ERRORLEVEL% equ 0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

REM 3) No PowerShell at all: emit in-context warning, stderr, and log, then exit non-zero.
REM    Emit the Cursor envelope shape unconditionally here. Harness-aware
REM    failure messages live in session-start.ps1 itself; this fallback only
REM    fires when the .ps1 cannot be invoked at all (no PS on Windows), at
REM    which point the harness arg has not been parsed. Cursor users see the
REM    intended failure; Claude users see a malformed-but-recognisable JSON
REM    that still tells them what's wrong.
echo {"additional_context":"<EXTREMELY_IMPORTANT>SuperSpecs SessionStart hook FAILED (F3): no PowerShell found on Windows. The 'using-superspecs' skill was NOT loaded. Diagnostic log: %%TEMP%%\superspecs-hook.log. Do NOT pretend SuperSpecs discipline is active in this session - tell the user the framework failed to load.</EXTREMELY_IMPORTANT>"}
echo superspecs: no PowerShell found; SuperSpecs context NOT injected; see %%TEMP%%\superspecs-hook.log 1>&2
>> "%TEMP%\superspecs-hook.log" echo %DATE% %TIME%	F3	%SCRIPT_NAME%	no powershell.exe and no pwsh on PATH
exit /b 4
CMDBLOCK

# Unix: run the named script directly (unchanged behavior).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
