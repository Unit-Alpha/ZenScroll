// ==UserScript==
// @name           shift-scroll-tabs
// @description    Switch tabs with Shift+Scroll; skip tabs in the same split-view group
// ==/UserScript==

// about:config knobs (take effect immediately, no restart needed):
//   userscripts.tabslide.invertScroll   (boolean, default false — swap scroll direction)

(function() {
  // Returns a Set of all tabs in the same split-view group as `tab`, or null if none.
  function getSplitGroupTabs(tab) {
    try {
      const splitter = window.gZenViewSplitter;
      if (!splitter) return null;
      const idx = tab.splitViewValue;
      if (idx === undefined || idx === null) return null;
      const group = splitter._data[idx];
      if (!group || !Array.isArray(group.tabs) || group.tabs.length < 2) return null;
      return new Set(group.tabs.filter(t => !t.closing));
    } catch (e) {
      return null;
    }
  }

  function navigate(direction) {
    const tabs = Array.from(gBrowser.tabs).filter(t => !t.hidden && !t.closing && !t.hasAttribute('zen-empty-tab'));
    const current = gBrowser.selectedTab;
    const currentGroup = getSplitGroupTabs(current);

    let idx = tabs.indexOf(current);
    const len = tabs.length;

    for (let steps = 0; steps < len; steps++) {
      idx = (idx + direction + len) % len;
      const candidate = tabs[idx];
      // Skip tabs that are siblings in the same split-view
      if (currentGroup && currentGroup.has(candidate)) continue;
      gBrowser.selectedTab = candidate;
      return;
    }
  }

  function onWheel(event) {
    if (!event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    const invert = Services.prefs.getBoolPref("userscripts.tabslide.invertScroll", false);
    navigate(event.deltaY > 0 ? (invert ? -1 : 1) : (invert ? 1 : -1));
  }

  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
})();
