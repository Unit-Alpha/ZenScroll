// ==UserScript==
// @name           split-focus-follows-mouse
// @description    In split view, hovering the mouse over a panel makes it the
//                 active browser for navigation (back/forward/reload/shortcuts).
// ==/UserScript==

// about:config knob (takes effect immediately, no restart needed):
//   userscripts.tabslide.splitFocusFollowsMouse  (boolean, default false)

(function () {
  "use strict";

  // Returns true when `tab` is part of an active split-view group.
  function isActiveSplitTab(tab) {
    try {
      const splitter = window.gZenViewSplitter;
      if (!splitter) return false;
      const idx = tab.splitViewValue;
      if (idx === undefined || idx === null) return false;
      const group = splitter._data[idx];
      return !!(group && Array.isArray(group.tabs) && group.tabs.length >= 2);
    } catch (e) {
      return false;
    }
  }

  // Find the tab whose linked panel has a given element id.
  function tabForPanel(panelId) {
    return Array.from(gBrowser.tabs).find(t => t.linkedPanel === panelId) ?? null;
  }

  let hoverTimer = null;

  function onEnter(event) {
    if (!Services.prefs.getBoolPref("userscripts.tabslide.splitFocusFollowsMouse", false)) return;

    const panel = event.currentTarget;
    const tab   = tabForPanel(panel.id);
    if (!tab || tab.closing || tab.hidden) return;
    if (tab === gBrowser.selectedTab) return;
    if (!isActiveSplitTab(tab)) return;

    // Small delay to avoid accidental switches while passing the mouse through.
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (!tab.closing && !tab.hidden && isActiveSplitTab(tab)) {
        gBrowser.selectedTab = tab;
      }
    }, 80);
  }

  function onLeave() {
    clearTimeout(hoverTimer);
  }

  function attachTo(panel) {
    if (panel._splitFocusListenerAttached) return;
    panel._splitFocusListenerAttached = true;
    panel.addEventListener("mouseenter", onEnter);
    panel.addEventListener("mouseleave", onLeave);
  }

  const panelsEl = document.getElementById("tabbrowser-tabpanels");
  if (!panelsEl) return;

  // Attach to any split panels already present.
  for (const p of panelsEl.querySelectorAll('.browserSidebarContainer[zen-split="true"]')) {
    attachTo(p);
  }

  // Watch for panels being added or gaining zen-split="true".
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "zen-split") {
        if (m.target.getAttribute("zen-split") === "true") attachTo(m.target);
      }
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.classList.contains("browserSidebarContainer") && node.getAttribute("zen-split") === "true") {
          attachTo(node);
        }
      }
    }
  });

  observer.observe(panelsEl, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["zen-split"]
  });
})();
