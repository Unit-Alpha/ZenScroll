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
3. Copies the two userscripts into `chrome/JS/` in your profile.

Restart Zen Browser after installation.

## Uninstall

Remove the two files from your profile's `chrome/JS/` folder:

- `tab-slide-animation.uc.js`
- `shift-scroll-tabs.uc.js`

Then restart Zen. The fx-autoconfig files can stay; they don't do anything without scripts present.

## Options

All options are set in `about:config` and take effect immediately without restarting Zen.

| Preference | Type | Default | Description |
|---|---|---|---|
| `userscripts.tabslide.duration` | integer | `500` | Animation duration in milliseconds |
| `userscripts.tabslide.vertical` | boolean | `false` | Slide top/bottom instead of left/right |
| `userscripts.tabslide.invertAnimation` | boolean | `false` | Flip the visual slide direction (tab order unchanged) |
| `userscripts.tabslide.invertScroll` | boolean | `false` | Invert the Shift+Scroll direction |

The installer copies a `user.js` into your profile that declares all preferences with their default values. After the next Zen start they appear in `about:config` when you search for `userscripts.tabslide`.

**Important:** `user.js` is re-applied on every Zen startup and will reset any value you changed only in `about:config`. To make a change permanent, edit the value in `user.js` directly.

## Credits

- [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) by MrOtherGuy — userscript loader for Firefox-based browsers.

## Known Issues

### Panels shrink slightly during animation (Transparent Zen mod)

If tab panels appear to shrink or compress slightly during the slide animation, this is caused by the **Transparent Zen** mod being active.

**Fix:** Disable the Transparent Zen mod in Zen's mod settings.

You do **not** lose your transparent background by doing this — and this is actually a quirk you can use to your advantage:

1. In the Transparent Zen mod settings, make sure the transparency toggle is **on**.
2. Then **disable the mod itself** in Zen's mod list.

Because of how the mod is built, the transparency it applied stays active even after the mod is disabled. The mod's interference with animations does not. You end up with a transparent Zen and no animation bug.
