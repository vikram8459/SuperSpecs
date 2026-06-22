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

REM Detect the requested harness up front so the no-PowerShell fallback
REM below can emit the correct envelope shape (Cursor vs Claude). We scan
REM every forwarded arg for a --harness=<name> token. Default: cursor.
set "HARNESS=cursor"
for %%A in (%2 %3 %4 %5 %6 %7 %8 %9) do (
    set "ARG=%%A"
    call :parse_harness "%%A"
)

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
REM    The .ps1 could not be invoked, so we parse --harness= ourselves (above)
REM    and emit the matching envelope shape so Claude users get well-formed
REM    JSON in the expected wrapper rather than the Cursor shape.
set "FAIL_MSG=<EXTREMELY_IMPORTANT>SuperSpecs SessionStart hook FAILED (F3): no PowerShell found on Windows. The 'using-superspecs' skill was NOT loaded. Diagnostic log: %%TEMP%%\superspecs-hook.log. Do NOT pretend SuperSpecs discipline is active in this session - tell the user the framework failed to load.</EXTREMELY_IMPORTANT>"
if /I "%HARNESS%"=="claude" (
    echo {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%FAIL_MSG%"}}
) else (
    echo {"additional_context":"%FAIL_MSG%"}
)
echo superspecs: no PowerShell found; SuperSpecs context NOT injected; see %%TEMP%%\superspecs-hook.log 1>&2
>> "%TEMP%\superspecs-hook.log" echo %DATE% %TIME%	F3	%SCRIPT_NAME%	no powershell.exe and no pwsh on PATH
exit /b 4

:parse_harness
set "TOKEN=%~1"
if /I "%TOKEN:~0,10%"=="--harness=" set "HARNESS=%TOKEN:~10%"
goto :eof
CMDBLOCK

# Unix: run the named script directly (unchanged behavior).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
