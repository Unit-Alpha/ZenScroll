#!/usr/bin/env bash
# Install / Uninstall script for ZenScroll
# Works on Linux and macOS.
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

# ── Locate Zen profile ────────────────────────────────────────────────────────
ZEN_PROFILES_DIR="${HOME}/.config/zen"
if [[ "$(uname)" == "Darwin" ]]; then
  ZEN_PROFILES_DIR="${HOME}/Library/Application Support/zen"
fi

PROFILE=""
PROFILES_INI="$ZEN_PROFILES_DIR/profiles.ini"

if [[ -f "$PROFILES_INI" ]]; then
  rel_path=$(awk '/^\[Install/{found=1} found && /^Default=/{sub(/^Default=/,""); print; exit}' "$PROFILES_INI")
  if [[ -n "$rel_path" && -d "$ZEN_PROFILES_DIR/$rel_path" ]]; then
    PROFILE="$ZEN_PROFILES_DIR/$rel_path"
  fi
fi

if [[ -z "$PROFILE" && -d "$ZEN_PROFILES_DIR" ]]; then
  while IFS= read -r dir; do
    if [[ "$(basename "$dir")" =~ [Rr]elease ]]; then PROFILE="$dir"; break; fi
  done < <(find "$ZEN_PROFILES_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)
fi

if [[ -z "$PROFILE" && -d "$ZEN_PROFILES_DIR" ]]; then
  PROFILE="$(find "$ZEN_PROFILES_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -1)"
fi

echo "Zen installation : ${ZEN_APP:-not found}"
echo "Zen profile      : ${PROFILE:-not found}"
echo ""

# ── Main menu ─────────────────────────────────────────────────────────────────
echo "What would you like to do?"
echo "  1) Install"
echo "  2) Uninstall"
echo "  q) Quit"
echo ""
read -rp "Choice [1/2/q]: " main_choice

case "$main_choice" in
  1) ACTION="install" ;;
  2) ACTION="uninstall" ;;
  q|Q) echo "Aborted."; exit 0 ;;
  *) echo "Invalid choice."; exit 1 ;;
esac

# ═════════════════════════════════════════════════════════════════════════════
# INSTALL
# ═════════════════════════════════════════════════════════════════════════════
if [[ "$ACTION" == "install" ]]; then
  if [[ -z "$ZEN_APP" ]]; then
    echo "ERROR: Could not find Zen installation automatically."
    echo "  Set ZEN_APP manually at the top of this script."
    exit 1
  fi
  if [[ -z "$PROFILE" ]]; then
    echo "ERROR: Could not find a Zen profile in $ZEN_PROFILES_DIR"
    echo "  Set PROFILE manually at the top of this script."
    exit 1
  fi

  echo ""
  echo "Installing fx-autoconfig to $ZEN_APP (requires sudo)..."
  sudo cp "$SCRIPT_DIR/fx-autoconfig/config.js" "$ZEN_APP/config.js"
  sudo mkdir -p "$ZEN_APP/defaults/pref"
  sudo cp "$SCRIPT_DIR/fx-autoconfig/defaults/pref/config-prefs.js" \
          "$ZEN_APP/defaults/pref/config-prefs.js"

  echo "Installing fx-autoconfig utils to profile..."
  mkdir -p "$PROFILE/chrome/utils"
  cp "$SCRIPT_DIR/fx-autoconfig/chrome/utils/"* "$PROFILE/chrome/utils/"

  echo "Installing userscripts..."
  mkdir -p "$PROFILE/chrome/JS"
  cp "$SCRIPT_DIR/scripts/"*.uc.js "$PROFILE/chrome/JS/"

  echo "Installing user.js..."
  if [[ -f "$PROFILE/user.js" ]]; then
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
  exit 0
fi

# ═════════════════════════════════════════════════════════════════════════════
# UNINSTALL
# ═════════════════════════════════════════════════════════════════════════════
echo ""
echo "What would you like to remove?"
echo "  1) Userscripts only  (keep fx-autoconfig loader)"
echo "  2) Userscripts + user.js preferences"
echo "  3) Everything        (userscripts, user.js, fx-autoconfig)"
echo "  q) Quit"
echo ""
read -rp "Choice [1/2/3/q]: " unsub_choice

case "$unsub_choice" in
  1|2|3) ;;
  q|Q) echo "Aborted."; exit 0 ;;
  *) echo "Invalid choice."; exit 1 ;;
esac

echo ""

# Remove userscripts
if [[ -n "$PROFILE" ]]; then
  for f in \
    "$PROFILE/chrome/JS/tab-slide-animation.uc.js" \
    "$PROFILE/chrome/JS/shift-scroll-tabs.uc.js"; do
    if [[ -f "$f" ]]; then rm "$f"; echo "Removed: $f"; fi
  done
fi

# Remove user.js entries
if [[ "$unsub_choice" -ge 2 && -n "$PROFILE" && -f "$PROFILE/user.js" ]]; then
  sed -i '/userscripts\.tabslide\./d'               "$PROFILE/user.js"
  sed -i '/zen-tab-animation preferences/d'         "$PROFILE/user.js"
  sed -i '/These are read on every Zen startup/d'   "$PROFILE/user.js"
  sed -i '/Animation duration in milliseconds/d'    "$PROFILE/user.js"
  sed -i '/Slide top\/bottom instead of left\/right/d' "$PROFILE/user.js"
  sed -i '/Flip the visual slide direction/d'       "$PROFILE/user.js"
  sed -i '/Invert the Shift+Scroll direction/d'     "$PROFILE/user.js"
  echo "Removed: userscripts.tabslide entries from user.js"
  if [[ ! -s "$PROFILE/user.js" ]]; then
    rm "$PROFILE/user.js"
    echo "Removed: $PROFILE/user.js (was empty)"
  fi
fi

# Remove fx-autoconfig
if [[ "$unsub_choice" -ge 3 ]]; then
  if [[ -n "$PROFILE" && -d "$PROFILE/chrome/utils" ]]; then
    rm -rf "$PROFILE/chrome/utils"
    echo "Removed: $PROFILE/chrome/utils"
  fi
  if [[ -n "$ZEN_APP" ]]; then
    echo "Removing fx-autoconfig from $ZEN_APP (requires sudo)..."
    sudo rm -f "$ZEN_APP/config.js"
    sudo rm -f "$ZEN_APP/defaults/pref/config-prefs.js"
    echo "Removed: fx-autoconfig app files"
  else
    echo "WARNING: Zen installation not found."
    echo "  Manually remove config.js and defaults/pref/config-prefs.js"
    echo "  from your Zen application folder."
  fi
fi

echo ""
echo "Done. Restart Zen Browser to apply changes."
