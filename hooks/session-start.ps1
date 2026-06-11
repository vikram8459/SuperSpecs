# SessionStart hook for SuperSpecs (Windows / PowerShell sibling of hooks/session-start).
#
# Contract (MUST match hooks/session-start byte-for-byte after LF normalization):
#   1. Parse --harness=<name> from args (default: cursor).
#   2. Read <plugin_root>/skills/using-superspecs/SKILL.md as UTF-8.
#   3. Wrap content in the <EXTREMELY_IMPORTANT> envelope below.
#   4. Emit exactly one JSON object to stdout, shape determined by harness:
#        cursor -> { "additional_context": "<envelope>" }
#        claude -> { "hookSpecificOutput": { "hookEventName": "SessionStart",
#                                            "additionalContext": "<envelope>" } }
#   5. Exit 0 on success.
#   6. On failure: stderr line + append to %TEMP%\superspecs-hook.log + emit
#      warning JSON envelope to stdout + exit non-zero (F4/F5).
#
# IMPORTANT: stdout must contain ONLY the JSON object. All diagnostic /
# informational output goes through [Console]::Error.WriteLine(...).
# Do NOT use Write-Host here.
#
# If you change the envelope text below, mirror the change in hooks/session-start.

$ErrorActionPreference = 'Stop'

# Force UTF-8 stdout so non-ASCII characters in the skill (e.g. the U+2192
# right-arrow used in skip-skill examples) survive the host's console
# encoding round-trip. Without this, Windows defaults to the legacy
# OEM/ANSI codepage and any > 0x7F bytes are corrupted in piped output
# (which breaks downstream JSON.parse). Hooks ARE machine-consumed; the
# encoding must be deterministic.
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # If we can't set it (e.g. inside a transcript host), continue
    # anyway. ConvertTo-Json escapes non-ASCII as \uXXXX, so the JSON
    # is still well-formed even if the underlying transport mangles
    # arbitrary bytes -- but only because ConvertTo-Json does the
    # escaping, NOT printf-style output.
}

# Parse --harness=<name> from $args. Unknown/missing -> cursor (back-compat).
$Harness = 'cursor'
foreach ($a in $args) {
    if ($a -is [string] -and $a.StartsWith('--harness=')) {
        $Harness = $a.Substring('--harness='.Length)
    }
}

function Format-EnvelopeJson {
    param(
        # Allow empty string (used for the SUPERSPECS_DISABLE=1 path).
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text,
        [Parameter(Mandatory = $true)][string]$HarnessName
    )
    switch ($HarnessName) {
        'claude' {
            $inner = [ordered]@{
                hookEventName    = 'SessionStart'
                additionalContext = $Text
            }
            $obj = [ordered]@{ hookSpecificOutput = $inner }
            return ($obj | ConvertTo-Json -Compress -Depth 6)
        }
        default {
            # cursor (and any unknown name) gets the back-compat envelope.
            $obj = [ordered]@{ additional_context = $Text }
            return ($obj | ConvertTo-Json -Compress -Depth 6)
        }
    }
}

if ($env:SUPERSPECS_DISABLE -eq '1') {
    [Console]::Out.WriteLine((Format-EnvelopeJson -Text '' -HarnessName $Harness))
    exit 0
}

$LogPath = Join-Path $env:TEMP 'superspecs-hook.log'

function Write-HookLog {
    param([string]$Code, [string]$Details)
    try {
        $max = 1048576
        if ((Test-Path -LiteralPath $LogPath) -and ((Get-Item -LiteralPath $LogPath).Length -ge $max)) {
            $rotated = "$LogPath.1"
            if (Test-Path -LiteralPath $rotated) { Remove-Item -LiteralPath $rotated -Force }
            Move-Item -LiteralPath $LogPath -Destination $rotated -Force
        }
        $ts = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
        "$ts`t$Code`tsession-start[$Harness]`t$Details" | Out-File -FilePath $LogPath -Append -Encoding utf8
    } catch {
        # Best-effort. Don't compound failures if %TEMP% is unwritable.
    }
}

function Emit-FailureJson {
    param([string]$Code, [string]$Reason)
    $msg = "<EXTREMELY_IMPORTANT>SuperSpecs SessionStart hook FAILED ($Code): $Reason. The 'using-superspecs' skill was NOT loaded. Diagnostic log: $LogPath. Do NOT pretend SuperSpecs discipline is active in this session - tell the user the framework failed to load.</EXTREMELY_IMPORTANT>"
    return (Format-EnvelopeJson -Text $msg -HarnessName $Harness)
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

    # Single source of truth for the envelope TEXT (marker block + skill body).
    # Per-harness JSON wrappers differ only in outer shape; the inner text
    # is identical across every harness so the agent receives the same content.
    $envelope = "<EXTREMELY_IMPORTANT>`nYou have SuperSpecs.`n`n**Below is the full content of your 'spx:using-superspecs' skill - your introduction to using skills. For all other skills, read the corresponding 'skills/<skill-name>/SKILL.md' file with the Read tool when the skill becomes relevant:**`n`n$skill`n</EXTREMELY_IMPORTANT>"

    Write-HookLog -Code 'OK' -Details 'loaded'
    [Console]::Out.WriteLine((Format-EnvelopeJson -Text $envelope -HarnessName $Harness))
    exit 0
}
catch {
    $reason = $_.Exception.Message -replace "`r`n", ' ' -replace "`n", ' '
    Write-HookLog -Code 'F4' -Details $reason
    [Console]::Error.WriteLine("superspecs: session-start.ps1 failed (F4): $reason; see $LogPath")
    [Console]::Out.WriteLine((Emit-FailureJson -Code 'F4' -Reason $reason))
    exit 5
}
