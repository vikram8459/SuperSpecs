# SessionStart hook for SuperSpecs (Windows / PowerShell sibling of hooks/session-start).
#
# Contract (MUST match hooks/session-start byte-for-byte after LF normalization):
#   1. Read <plugin_root>/skills/using-superspecs/SKILL.md as UTF-8.
#   2. Wrap content in the <EXTREMELY_IMPORTANT> envelope below.
#   3. Emit exactly one JSON object to stdout: {"additional_context": "<envelope>"}.
#   4. Exit 0 on success.
#   5. On failure: stderr line + append to %TEMP%\superspecs-hook.log + emit warning
#      JSON envelope to stdout + exit non-zero (F4/F5).
#
# IMPORTANT: stdout must contain ONLY the JSON object. All diagnostic / informational
# output goes through [Console]::Error.WriteLine(...). Do NOT use Write-Host here.
#
# If you change the envelope text below, mirror the change in hooks/session-start.

$ErrorActionPreference = 'Stop'

if ($env:SUPERSPECS_DISABLE -eq '1') {
    $obj = [ordered]@{ additional_context = '' }
    [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4))
    exit 0
}

$LogPath = Join-Path $env:TEMP 'superspecs-hook.log'

function Write-HookLog {
    param([string]$Code, [string]$Details)
    try {
        $ts = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
        "$ts`t$Code`tsession-start`t$Details" | Out-File -FilePath $LogPath -Append -Encoding utf8
    } catch {
        # Best-effort. Don't compound failures if %TEMP% is unwritable.
    }
}

function Emit-FailureJson {
    param([string]$Code, [string]$Reason)
    $msg = "<EXTREMELY_IMPORTANT>SuperSpecs SessionStart hook FAILED ($Code): $Reason. The 'using-superspecs' skill was NOT loaded. Diagnostic log: $LogPath. Do NOT pretend SuperSpecs discipline is active in this session - tell the user the framework failed to load.</EXTREMELY_IMPORTANT>"
    $obj = [ordered]@{ additional_context = $msg }
    $obj | ConvertTo-Json -Compress -Depth 4
}

try {
    $PluginRoot = Split-Path -Parent $PSScriptRoot
    $SkillPath  = Join-Path $PluginRoot 'skills\using-superspecs\SKILL.md'

    if (-not (Test-Path -LiteralPath $SkillPath)) {
        throw "skill file not found: $SkillPath"
    }

    $skill = Get-Content -Raw -LiteralPath $SkillPath -Encoding UTF8

    # Strip UTF-8 BOM if present.
    if ($skill.Length -gt 0 -and $skill[0] -eq [char]0xFEFF) {
        $skill = $skill.Substring(1)
    }

    # Normalize line endings to \n so Windows and Unix emit identical payloads.
    $skill = $skill -replace "`r`n", "`n" -replace "`r", "`n"

    $envelope = "<EXTREMELY_IMPORTANT>`nYou have SuperSpecs.`n`n**Below is the full content of your 'spx:using-superspecs' skill - your introduction to using skills. For all other skills, read the corresponding 'skills/<skill-name>/SKILL.md' file with the Read tool when the skill becomes relevant:**`n`n$skill`n</EXTREMELY_IMPORTANT>"

    $obj  = [ordered]@{ additional_context = $envelope }
    $json = $obj | ConvertTo-Json -Compress -Depth 4

    [Console]::Out.WriteLine($json)
    exit 0
}
catch {
    $reason = $_.Exception.Message -replace "`r`n", ' ' -replace "`n", ' '
    Write-HookLog -Code 'F4' -Details $reason
    [Console]::Error.WriteLine("superspecs: session-start.ps1 failed (F4): $reason; see $LogPath")
    Emit-FailureJson -Code 'F4' -Reason $reason
    exit 5
}
