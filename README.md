# ZenScroll

Hyprland-style tab slide animation and Shift+Scroll tab switching for [Zen Browser](https://zen-browser.app).

- Tabs slide left/right (or top/bottom) when switching, like workspaces in Hyprland.
- Split-view groups animate as a single unit.
- Switch tabs with Shift+Scroll, skipping siblings in the same split group.
- All options are configurable live in `about:config`.

## Installation

### Linux / macOS

```bash
chmod +x install.sh
./install.sh
```

The script needs `sudo` to write to the Zen application folder.

### Windows

Right-click `install.ps1` and choose **Run as Administrator**, or run in an elevated PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
```

### What the installer does

1. Copies `fx-autoconfig` files into the Zen application directory.
   This is a one-time loader that enables `.uc.js` userscripts in Zen/Firefox.
2. Copies the userscript loader (`chrome/utils/`) into your Zen profile.
3. Copies the four userscripts into `chrome/JS/` in your profile.

Restart Zen Browser after installation.

## Uninstall

The easiest way is to run the install script again and choose **Uninstall** from the menu. It will ask what you want to remove:

- **Userscripts only** — removes the two `.uc.js` files; fx-autoconfig stays intact
- **Userscripts + user.js preferences** — also cleans up the `about:config` entries
- **Everything** — additionally removes fx-autoconfig from the profile and the Zen application folder

Alternatively you can remove files manually. The userscripts are in your profile's `chrome/JS/` folder:

- `tab-slide-animation.uc.js`
- `shift-scroll-tabs.uc.js`
- `split-focus-follows-mouse.uc.js`
- `split-view-drag.uc.js`

The fx-autoconfig files can stay if you want to use other userscripts later; they don't do anything without scripts present.

## Options

All options are set in `about:config` and take effect immediately without restarting Zen.

| Preference | Type | Default | Description |
|---|---|---|---|
| `userscripts.tabslide.duration` | integer | `500` | Animation duration in milliseconds |
| `userscripts.tabslide.vertical` | boolean | `false` | Slide top/bottom instead of left/right |
| `userscripts.tabslide.invertAnimation` | boolean | `false` | Flip the visual slide direction (tab order unchanged) |
| `userscripts.tabslide.invertScroll` | boolean | `false` | Invert the Shift+Scroll direction |
| `userscripts.tabslide.splitFocusFollowsMouse` | boolean | `true` | In split view, hovering the mouse over a panel makes it the active browser — so reload/back/forward act on the panel under the cursor without needing to click it first. Hold **Shift** while hovering to temporarily suppress this (useful when you need to move the mouse across other panels to reach a button without accidentally switching focus). |
| `userscripts.tabslide.hideSplitHeader` | boolean | `true` | Hide the blue move/unsplit header bar that normally appears on hover in split view. |
| `userscripts.tabslide.shiftDragRearrange` | boolean | `true` | Hold **Shift** and drag a split panel to rearrange it within the group. While Shift is held, panels become draggable — press and hold the left mouse button on a panel, then drag it onto another panel to swap their positions. |

The installer copies a `user.js` into your profile that declares all preferences with their default values. After the next Zen start they appear in `about:config` when you search for `userscripts.tabslide`.

**Important:** `user.js` is re-applied on every Zen startup and will reset any value you changed only in `about:config`. To make a change permanent, edit the value in `user.js` directly.

## Credits

- [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) by MrOtherGuy — userscript loader for Firefox-based browsers.

## Known Issues

### Animation glitches caused by other Zen mods

Some Zen mods include their own tab-switch animations (e.g. scale, fade, or blur effects). These can conflict with ZenScroll and cause visual glitches like panels shrinking, flickering, or animating incorrectly.

- If the mod has settings, look for a tab-switch animation option and disable it — you don't need to disable the mod itself.
- If the mod has no settings, disable the mod entirely.