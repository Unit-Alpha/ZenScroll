# Install / Uninstall script for ZenScroll
# Works on Windows. Run as Administrator (required to write to the Zen installation folder).
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# ── Locate Zen installation ───────────────────────────────────────────────────
$ZenApp = $null
foreach ($path in @(
    "$env:PROGRAMFILES\Zen Browser",
    "$env:PROGRAMFILES\zen-browser",
    "$env:LOCALAPPDATA\Zen Browser",
    "$env:LOCALAPPDATA\zen-browser",
    "$env:LOCALAPPDATA\Programs\zen-browser"
)) {
    if (Test-Path "$path\zen.exe") { $ZenApp = $path; break }
}

# ── Locate Zen profile ────────────────────────────────────────────────────────
$ProfileBase = "$env:APPDATA\zen"
$ProfilesIni = "$ProfileBase\profiles.ini"
$ProfilePath = $null

if (Test-Path $ProfilesIni) {
    $inInstall = $false
    foreach ($line in (Get-Content $ProfilesIni)) {
        if ($line -match '^\[Install') { $inInstall = $true; continue }
        if ($inInstall -and $line -match '^\[') { $inInstall = $false }
        if ($inInstall -and $line -match '^Default=(.+)') {
            $rel = $Matches[1].Trim()
            $candidate = Join-Path $ProfileBase $rel
            if (Test-Path $candidate -PathType Container) { $ProfilePath = $candidate; break }
        }
    }
}
if (-not $ProfilePath -and (Test-Path $ProfileBase)) {
    $d = Get-ChildItem $ProfileBase -Directory | Where-Object { $_.Name -imatch 'release' } | Select-Object -First 1
    if ($d) { $ProfilePath = $d.FullName }
}
if (-not $ProfilePath -and (Test-Path $ProfileBase)) {
    $d = Get-ChildItem $ProfileBase -Directory | Select-Object -First 1
    if ($d) { $ProfilePath = $d.FullName }
}

Write-Host "Zen installation : $(if ($ZenApp) { $ZenApp } else { 'not found' })"
Write-Host "Zen profile      : $(if ($ProfilePath) { $ProfilePath } else { 'not found' })"
Write-Host ""

# ── Main menu ─────────────────────────────────────────────────────────────────
Write-Host "What would you like to do?"
Write-Host "  1) Install"
Write-Host "  2) Uninstall"
Write-Host "  q) Quit"
Write-Host ""
$mainChoice = Read-Host "Choice [1/2/q]"

if ($mainChoice -in 'q','Q') { Write-Host "Aborted."; exit 0 }
if ($mainChoice -notin '1','2') { Write-Host "Invalid choice."; exit 1 }

# ═════════════════════════════════════════════════════════════════════════════
# INSTALL
# ═════════════════════════════════════════════════════════════════════════════
if ($mainChoice -eq '1') {
    if (-not $ZenApp) {
        Write-Error "Could not find Zen installation. Edit `$ZenApp manually at the top of this script."
        exit 1
    }
    if (-not $ProfilePath) {
        Write-Error "Could not find a Zen profile in $ProfileBase"
        exit 1
    }

    Write-Host ""
    Write-Host "Installing fx-autoconfig to $ZenApp..."
    Copy-Item "$ScriptDir\fx-autoconfig\config.js" "$ZenApp\config.js" -Force
    New-Item -ItemType Directory -Force -Path "$ZenApp\defaults\pref" | Out-Null
    Copy-Item "$ScriptDir\fx-autoconfig\defaults\pref\config-prefs.js" `
              "$ZenApp\defaults\pref\config-prefs.js" -Force

    Write-Host "Installing fx-autoconfig utils to profile..."
    New-Item -ItemType Directory -Force -Path "$ProfilePath\chrome\utils" | Out-Null
    Copy-Item "$ScriptDir\fx-autoconfig\chrome\utils\*" "$ProfilePath\chrome\utils\" -Force

    Write-Host "Installing userscripts..."
    New-Item -ItemType Directory -Force -Path "$ProfilePath\chrome\JS" | Out-Null
    Copy-Item "$ScriptDir\scripts\*.uc.js" "$ProfilePath\chrome\JS\" -Force

    Write-Host "Installing user.js..."
    $userJs = "$ProfilePath\user.js"
    if (Test-Path $userJs) {
        $existing = Get-Content $userJs -Raw
        foreach ($line in (Get-Content "$ScriptDir\user.js")) {
            if ($line -match 'userscripts\.tabslide\.([^"]+)') {
                $key = $Matches[0]
                if ($existing -notmatch [regex]::Escape($key)) {
                    Add-Content $userJs $line
                }
            }
        }
    } else {
        Copy-Item "$ScriptDir\user.js" $userJs -Force
    }

    Write-Host ""
    Write-Host "Done. Restart Zen Browser to activate the animations."
    exit 0
}

# ═════════════════════════════════════════════════════════════════════════════
# UNINSTALL
# ═════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "What would you like to remove?"
Write-Host "  1) Userscripts only  (keep fx-autoconfig loader)"
Write-Host "  2) Userscripts + user.js preferences"
Write-Host "  3) Everything        (userscripts, user.js, fx-autoconfig)"
Write-Host "  q) Quit"
Write-Host ""
$unChoice = Read-Host "Choice [1/2/3/q]"

if ($unChoice -in 'q','Q') { Write-Host "Aborted."; exit 0 }
if ($unChoice -notin '1','2','3') { Write-Host "Invalid choice."; exit 1 }
$unNum = [int]$unChoice

Write-Host ""

# Remove userscripts
if ($ProfilePath) {
    foreach ($f in @(
        "$ProfilePath\chrome\JS\tab-slide-animation.uc.js",
        "$ProfilePath\chrome\JS\shift-scroll-tabs.uc.js"
    )) {
        if (Test-Path $f) { Remove-Item $f; Write-Host "Removed: $f" }
    }
}

# Remove user.js entries
if ($unNum -ge 2 -and $ProfilePath) {
    $userJs = "$ProfilePath\user.js"
    if (Test-Path $userJs) {
        $patterns = @(
            'userscripts\.tabslide\.',
            'zen-tab-animation preferences',
            'These are read on every Zen startup',
            'Animation duration in milliseconds',
            'Slide top/bottom instead of left/right',
            'Flip the visual slide direction',
            'Invert the Shift\+Scroll direction'
        )
        $filtered = Get-Content $userJs | Where-Object {
            $l = $_; -not ($patterns | Where-Object { $l -match $_ })
        }
        while ($filtered -and $filtered[-1] -match '^\s*$') {
            $filtered = $filtered[0..($filtered.Count - 2)]
        }
        if ($filtered) {
            $filtered | Set-Content $userJs
            Write-Host "Removed: userscripts.tabslide entries from user.js"
        } else {
            Remove-Item $userJs
            Write-Host "Removed: $userJs (was empty)"
        }
    }
}

# Remove fx-autoconfig
if ($unNum -ge 3) {
    if ($ProfilePath) {
        $utils = "$ProfilePath\chrome\utils"
        if (Test-Path $utils) { Remove-Item $utils -Recurse -Force; Write-Host "Removed: $utils" }
    }
    if ($ZenApp) {
        foreach ($f in @(
            "$ZenApp\config.js",
            "$ZenApp\defaults\pref\config-prefs.js"
        )) {
            if (Test-Path $f) { Remove-Item $f; Write-Host "Removed: $f" }
        }
    } else {
        Write-Host "WARNING: Zen installation not found."
        Write-Host "  Manually remove config.js and defaults\pref\config-prefs.js"
        Write-Host "  from your Zen application folder."
    }
}

Write-Host ""
Write-Host "Done. Restart Zen Browser to apply changes."
