// Tab Slide Animation - Hyprland-style workspace transition

(function () {
  "use strict";

  // about:config knobs (take effect immediately, no restart needed):
  //   userscripts.tabslide.duration        (integer, ms, default 500)
  //   userscripts.tabslide.vertical        (boolean, default false — slide top/bottom instead of left/right)
  //   userscripts.tabslide.invertAnimation (boolean, default false — flip the visual slide direction)

  const style = document.createElement("style");
  style.textContent = `
    #tabbrowser-tabpanels {
      overflow: clip !important;
      overflow-clip-margin: 4px !important;
    }
    #tabbrowser-tabpanels hbox.browserSidebarContainer.zen-slide-out {
      -moz-subtree-hidden-only-visually: 0 !important;
      visibility: visible !important;
      pointer-events: none !important;
      animation: none !important;
      transition: none !important;
      scale: 1 !important;
      opacity: 1 !important;
    }
    #tabbrowser-tabpanels hbox.browserSidebarContainer.zen-slide-in {
      animation: none !important;
      transition: none !important;
      scale: 1 !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);

  function isRealTab(t) {
    return !t.hidden && !t.closing && !t.hasAttribute('zen-empty-tab');
  }

  function getVisibleIndex(tab) {
    return Array.from(gBrowser.tabs)
      .filter(isRealTab)
      .indexOf(tab);
  }

  // Returns all tabs in the same split-view group as `tab`, or [tab] if not in a group.
  function getSplitGroupTabs(tab) {
    try {
      const splitter = window.gZenViewSplitter;
      if (!splitter) return [tab];
      const idx = tab.splitViewValue;
      if (idx === undefined || idx === null) return [tab];
      const group = splitter._data[idx];
      if (!group || !Array.isArray(group.tabs) || group.tabs.length < 2) return [tab];
      return group.tabs.filter(t => !t.closing);
    } catch (e) {
      return [tab];
    }
  }

  // Returns the panel elements for a list of tabs, excluding nulls.
  function getPanelsForTabs(tabs) {
    return tabs
      .map(t => document.getElementById(t.linkedPanel))
      .filter(Boolean);
  }

  let lastIndex = getVisibleIndex(gBrowser.selectedTab);
  let lastTab   = gBrowser.selectedTab;

  // Cleanup callbacks keyed by panel. Run on animation finish or at the start of
  // the next transition, whichever comes first, to avoid stranded pointer-events.
  const pendingCleanup = new Map();

  function runCleanup(panel) {
    const fn = pendingCleanup.get(panel);
    if (fn) { fn(); pendingCleanup.delete(panel); }
  }

  function runAllCleanups() {
    for (const [panel] of pendingCleanup) runCleanup(panel);
  }

  gBrowser.tabContainer.addEventListener("TabSelect", function (event) {
    const newTab   = event.target;
    if (!isRealTab(newTab)) return;
    const newIndex = getVisibleIndex(newTab);
    if (newIndex === lastIndex) { lastIndex = newIndex; lastTab = newTab; return; }

    // Slide direction: shortest path on the circular tab band.
    const totalTabs  = Array.from(gBrowser.tabs).filter(isRealTab).length;
    const directDelta  = newIndex - lastIndex;
    const wrappedDelta = directDelta > 0 ? directDelta - totalTabs : directDelta + totalTabs;
    const useDelta     = Math.abs(wrappedDelta) < Math.abs(directDelta) ? wrappedDelta : directDelta;
    const goingRight   = useDelta > 0;

    const DURATION        = Services.prefs.getIntPref("userscripts.tabslide.duration", 500);
    const VERTICAL        = Services.prefs.getBoolPref("userscripts.tabslide.vertical", false);
    const invertAnimation = Services.prefs.getBoolPref("userscripts.tabslide.invertAnimation", false);
    const axis            = VERTICAL ? "translateY" : "translateX";
    const slideRight      = invertAnimation ? !goingRight : goingRight;

    const panelsEl  = document.getElementById("tabbrowser-tabpanels");
    const oldTab    = lastTab;

    lastIndex = newIndex;
    lastTab   = newTab;

    runAllCleanups();

    const oldGroupTabs = getSplitGroupTabs(oldTab);
    const newGroupTabs = getSplitGroupTabs(newTab);

    // No animation when switching within the same split-view group.
    if (oldGroupTabs.length > 1 && oldGroupTabs.includes(newTab)) return;

    const newPanel = document.getElementById(newTab.linkedPanel);
    if (!newPanel) return;

    const offset = VERTICAL
      ? (panelsEl ? panelsEl.offsetHeight : 600)
      : (panelsEl ? panelsEl.offsetWidth  : 800);

    // Capture outgoing panels' top position before any DOM changes.
    const oldPanelPreY = new Map();
    for (const p of getPanelsForTabs(oldGroupTabs)) {
      oldPanelPreY.set(p.id, p.getBoundingClientRect().top);
    }

    // Resolve the split gap. --zen-split-column-gap may not be available when
    // switching into a split view for the first time, so fall back to
    // --zen-element-separation + 1px (matching Zen's own formula).
    const rawGap = panelsEl
      ? parseFloat(getComputedStyle(panelsEl).getPropertyValue('--zen-split-column-gap'))
      : NaN;
    const gapPx = rawGap > 0
      ? rawGap
      : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zen-element-separation')) || 8) + 1;

    // Gap between outgoing and incoming panels during animation.
    // Split panels already carry a natural gapPx margin-right, so only add
    // the remainder to reach 2*gapPx total.
    const isSplitInvolved = oldGroupTabs.length > 1 || newGroupTabs.length > 1;
    const slideGap = isSplitInvolved ? gapPx : 2 * gapPx;

    const newGroupIds = new Set(newGroupTabs.map(t => t.linkedPanel));
    const oldPanels   = getPanelsForTabs(oldGroupTabs).filter(p => !newGroupIds.has(p.id));
    const newPanels   = getPanelsForTabs(newGroupTabs);

    // Lock outgoing panel dimensions before the container layout changes.
    const oldPanelHeights = new Map();
    const oldPanelWidths  = new Map();
    for (const p of oldPanels) {
      oldPanelHeights.set(p.id, p.offsetHeight);
      oldPanelWidths.set(p.id, p.offsetWidth);
    }

    // Lock the container to its final margin-top immediately so incoming panels
    // animate inside the correctly-sized container.
    const finalContainerMarginPx = newGroupTabs.length > 1 ? -gapPx : 0;
    if (panelsEl) {
      panelsEl.style.marginTop = finalContainerMarginPx + 'px';
    }

    let pendingAnims = oldPanels.length + newPanels.length;
    function releaseMarginLock() {
      if (--pendingAnims <= 0 && panelsEl) panelsEl.style.removeProperty("margin-top");
    }

    // Keep split browsers rendering while they slide out.
    if (oldGroupTabs.length > 1) {
      for (const tab of oldGroupTabs) {
        const browser = tab.linkedBrowser;
        if (!browser) continue;
        Object.defineProperty(browser, 'zenModeActive', {
          get: () => true, set: () => {}, configurable: true
        });
      }
    }

    for (const p of oldPanels) {
      p.classList.add("zen-slide-out");
      const h = oldPanelHeights.get(p.id);
      if (h !== undefined) p.style.height = h + 'px';
      const w = oldPanelWidths.get(p.id);
      if (w !== undefined) p.style.width = w + 'px';
    }
    for (const p of newPanels) {
      p.classList.add("zen-slide-in");
      p.style.transform = `${axis}(${slideRight ? (offset + slideGap) : -(offset + slideGap)}px)`;
    }

    requestAnimationFrame(() => {
      // Catch any split panels that Zen activated after our sync snapshot.
      // Happens on the first switch to a split group whose tabs hadn't loaded yet.
      if (panelsEl) {
        const knownNewIds = new Set(newPanels.map(p => p.id));
        const extraPanels = Array.from(
          panelsEl.querySelectorAll('.browserSidebarContainer[zen-split="true"]')
        ).filter(p => !knownNewIds.has(p.id) && !p.classList.contains("zen-slide-out"));
        for (const p of extraPanels) {
          p.classList.add("zen-slide-in");
          p.getAnimations({ subtree: true }).forEach(a => a.cancel());
          p.style.removeProperty("transform");
          const anim = p.animate(
            [
              { transform: `${axis}(${slideRight ? (offset + slideGap) : -(offset + slideGap)}px)`, opacity: 1 },
              { transform: `${axis}(0px)`, opacity: 1 }
            ],
            { duration: DURATION, easing: "cubic-bezier(0.65, 0.05, 0.36, 1)", fill: "both" }
          );
          pendingAnims++;
          anim.addEventListener("finish", () => runCleanup(p), { once: true });
          pendingCleanup.set(p, () => {
            p.classList.remove("zen-slide-in");
            anim.cancel();
            releaseMarginLock();
          });
        }
      }

      // Slide old group out.
      for (const p of oldPanels) {
        p.getAnimations({ subtree: true }).forEach(a => a.cancel());
        const tab = oldGroupTabs.find(t => t.linkedPanel === p.id);
        p.style.removeProperty("transform");
        const shiftY = p.getBoundingClientRect().top - (oldPanelPreY.get(p.id) ?? 0);
        const anim = p.animate(
          VERTICAL ? [
            { transform: `translateY(${-shiftY}px)`, opacity: 1 },
            { transform: `translateY(${slideRight ? -(offset + slideGap) : (offset + slideGap)}px)`, opacity: 1 }
          ] : [
            { transform: `translateX(0px) translateY(${-shiftY}px)`, opacity: 1 },
            { transform: `translateX(${slideRight ? -(offset + slideGap) : (offset + slideGap)}px) translateY(${-shiftY}px)`, opacity: 1 }
          ],
          { duration: DURATION, easing: "cubic-bezier(0.65, 0.05, 0.36, 1)", fill: "forwards" }
        );
        anim.addEventListener("finish", () => runCleanup(p), { once: true });
        pendingCleanup.set(p, () => {
          p.classList.remove("zen-slide-out");
          p.style.removeProperty("height");
          p.style.removeProperty("width");
          anim.cancel();
          releaseMarginLock();
          if (tab?.linkedBrowser) delete tab.linkedBrowser.zenModeActive;
        });
      }

      // Slide new group in.
      for (const p of newPanels) {
        p.getAnimations({ subtree: true }).forEach(a => a.cancel());
        p.style.removeProperty("transform");
        const anim = p.animate(
          [
            { transform: `${axis}(${slideRight ? (offset + slideGap) : -(offset + slideGap)}px)`, opacity: 1 },
            { transform: `${axis}(0px)`, opacity: 1 }
          ],
          { duration: DURATION, easing: "cubic-bezier(0.65, 0.05, 0.36, 1)", fill: "both" }
        );
        anim.addEventListener("finish", () => runCleanup(p), { once: true });
        pendingCleanup.set(p, () => {
          p.classList.remove("zen-slide-in");
          anim.cancel();
          releaseMarginLock();
        });
      }
    });
  });

  gBrowser.tabContainer.addEventListener("TabClose", function () {
    lastIndex = getVisibleIndex(gBrowser.selectedTab);
    lastTab   = gBrowser.selectedTab;
  });
})();
