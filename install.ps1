# Installer for zen-tab-animation
# Installs fx-autoconfig + userscripts into Zen Browser on Windows.
# Run as Administrator (required to write to the Zen installation folder).
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# ── Locate Zen installation ───────────────────────────────────────────────────
$ZenApp = $null
$SearchPaths = @(
    "$env:PROGRAMFILES\Zen Browser",
    "$env:PROGRAMFILES\zen-browser",
    "$env:LOCALAPPDATA\Zen Browser",
    "$env:LOCALAPPDATA\zen-browser"
)
foreach ($path in $SearchPaths) {
    if (Test-Path "$path\zen.exe") {
        $ZenApp = $path
        break
    }
}

if (-not $ZenApp) {
    Write-Error "Could not find Zen installation. Edit `$ZenApp manually at the top of this script."
    exit 1
}

# ── Locate Zen profile ────────────────────────────────────────────────────────
$ProfileBase = "$env:APPDATA\zen\Profiles"
$Profile = $null

if (Test-Path $ProfileBase) {
    # Prefer a profile whose name contains "default" or "release"
    $Profile = Get-ChildItem $ProfileBase -Directory |
        Where-Object { $_.Name -imatch "default|release" } |
        Select-Object -First 1
    if (-not $Profile) {
        $Profile = Get-ChildItem $ProfileBase -Directory | Select-Object -First 1
    }
}

if (-not $Profile) {
    Write-Error "Could not find a Zen profile in $ProfileBase"
    exit 1
}

$ProfilePath = $Profile.FullName
Write-Host "Zen installation : $ZenApp"
Write-Host "Zen profile      : $ProfilePath"
Write-Host ""

# ── Install fx-autoconfig to application directory ────────────────────────────
Write-Host "Installing fx-autoconfig to $ZenApp..."
Copy-Item "$ScriptDir\fx-autoconfig\config.js" "$ZenApp\config.js" -Force
New-Item -ItemType Directory -Force -Path "$ZenApp\defaults\pref" | Out-Null
Copy-Item "$ScriptDir\fx-autoconfig\defaults\pref\config-prefs.js" `
          "$ZenApp\defaults\pref\config-prefs.js" -Force

# ── Install utils to profile ──────────────────────────────────────────────────
Write-Host "Installing fx-autoconfig utils to profile..."
New-Item -ItemType Directory -Force -Path "$ProfilePath\chrome\utils" | Out-Null
Copy-Item "$ScriptDir\fx-autoconfig\chrome\utils\*" `
          "$ProfilePath\chrome\utils\" -Force

# ── Install userscripts ───────────────────────────────────────────────────────
Write-Host "Installing userscripts..."
New-Item -ItemType Directory -Force -Path "$ProfilePath\chrome\JS" | Out-Null
Copy-Item "$ScriptDir\scripts\*.uc.js" "$ProfilePath\chrome\JS\" -Force

# ── Install user.js (declares about:config preferences) ──────────────────────
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
