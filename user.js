// zen-tab-animation preferences
// These are read on every Zen startup. Edit values here or in about:config.

// Animation duration in milliseconds (default: 500)
user_pref("userscripts.tabslide.duration", 500);

// Slide top/bottom instead of left/right (default: false)
user_pref("userscripts.tabslide.vertical", false);

// Flip the visual slide direction without changing tab order (default: false)
user_pref("userscripts.tabslide.invertAnimation", false);

// Invert the Shift+Scroll direction (default: false)
user_pref("userscripts.tabslide.invertScroll", false);

// In split view, hover-to-focus: hovering over a panel makes it the active
// browser so reload/back/forward act on it without clicking first (default: true)
user_pref("userscripts.tabslide.splitFocusFollowsMouse", true);

// Hide the blue move/unsplit header bar in split view (default: true)
user_pref("userscripts.tabslide.hideSplitHeader", true);

// Hold Shift and drag a split panel to rearrange it within the group (default: true)
user_pref("userscripts.tabslide.shiftDragRearrange", true);
