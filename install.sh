#!/usr/bin/env bash
# Installer for zen-tab-animation
# Installs fx-autoconfig + userscripts into Zen Browser on Linux/macOS.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Locate Zen installation ───────────────────────────────────────────────────
ZEN_APP=""
for dir in \
    /opt/zen-browser-bin \
    /opt/zen-browser \
    /usr/lib/zen-browser \
    /usr/local/lib/zen-browser \
    "$HOME/.local/lib/zen-browser" \
    "$HOME/Applications/zen-browser"; do
  if [[ -f "$dir/zen" || -f "$dir/zen-bin" ]]; then
    ZEN_APP="$dir"
    break
  fi
done

if [[ -z "$ZEN_APP" ]]; then
  echo "ERROR: Could not find Zen installation automatically."
  echo "  Set ZEN_APP manually at the top of this script."
  exit 1
fi

# ── Locate Zen profile ────────────────────────────────────────────────────────
ZEN_PROFILES_DIR="${HOME}/.config/zen"
if [[ "$(uname)" == "Darwin" ]]; then
  ZEN_PROFILES_DIR="${HOME}/Library/Application Support/zen"
fi

PROFILE=""
PROFILES_INI="$ZEN_PROFILES_DIR/profiles.ini"

if [[ -f "$PROFILES_INI" ]]; then
  # Most reliable: use the path from the [Install...] section, which is what Zen
  # itself reads to decide which profile to open for this installation.
  rel_path=$(awk '/^\[Install/{found=1} found && /^Default=/{sub(/^Default=/,""); print; exit}' "$PROFILES_INI")
  if [[ -n "$rel_path" && -d "$ZEN_PROFILES_DIR/$rel_path" ]]; then
    PROFILE="$ZEN_PROFILES_DIR/$rel_path"
  fi
fi

# Fallback: profile whose name contains "release"
if [[ -z "$PROFILE" && -d "$ZEN_PROFILES_DIR" ]]; then
  while IFS= read -r dir; do
    if [[ "$(basename "$dir")" =~ [Rr]elease ]]; then
      PROFILE="$dir"; break
    fi
  done < <(find "$ZEN_PROFILES_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)
fi

# Final fallback: first profile directory found
if [[ -z "$PROFILE" && -d "$ZEN_PROFILES_DIR" ]]; then
  PROFILE="$(find "$ZEN_PROFILES_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -1)"
fi

if [[ -z "$PROFILE" ]]; then
  echo "ERROR: Could not find a Zen profile in $ZEN_PROFILES_DIR"
  echo "  Set PROFILE manually at the top of this script."
  exit 1
fi

echo "Zen installation : $ZEN_APP"
echo "Zen profile      : $PROFILE"
echo ""

# ── Install fx-autoconfig to application directory (requires sudo) ────────────
echo "Installing fx-autoconfig to $ZEN_APP (requires sudo)..."
sudo cp "$SCRIPT_DIR/fx-autoconfig/config.js" "$ZEN_APP/config.js"
sudo mkdir -p "$ZEN_APP/defaults/pref"
sudo cp "$SCRIPT_DIR/fx-autoconfig/defaults/pref/config-prefs.js" \
        "$ZEN_APP/defaults/pref/config-prefs.js"

# ── Install utils to profile ──────────────────────────────────────────────────
echo "Installing fx-autoconfig utils to profile..."
mkdir -p "$PROFILE/chrome/utils"
cp "$SCRIPT_DIR/fx-autoconfig/chrome/utils/"* "$PROFILE/chrome/utils/"

# ── Install userscripts ───────────────────────────────────────────────────────
echo "Installing userscripts..."
mkdir -p "$PROFILE/chrome/JS"
cp "$SCRIPT_DIR/scripts/"*.uc.js "$PROFILE/chrome/JS/"

# ── Install user.js (declares about:config preferences) ──────────────────────
echo "Installing user.js..."
if [[ -f "$PROFILE/user.js" ]]; then
  # Append only lines not already present
  while IFS= read -r line; do
    pref=$(echo "$line" | grep -o 'userscripts\.tabslide\.[^"]*' | head -1)
    if [[ -n "$pref" ]] && ! grep -qF "$pref" "$PROFILE/user.js"; then
      echo "$line" >> "$PROFILE/user.js"
    fi
  done < "$SCRIPT_DIR/user.js"
else
  cp "$SCRIPT_DIR/user.js" "$PROFILE/user.js"
fi

echo ""
echo "Done. Restart Zen Browser to activate the animations."
