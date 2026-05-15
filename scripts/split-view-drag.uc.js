// ==UserScript==
// @name           split-view-drag
// @description    Optionally hide the built-in split header (blue move/unsplit bar).
//                 Hold Shift while in split view to reveal "grab" overlays; then
//                 drag a panel to rearrange it within the split group.
// ==/UserScript==

// about:config knobs (live — no restart needed):
//   userscripts.tabslide.hideSplitHeader    (boolean, default true  — hide the blue header bar)
//   userscripts.tabslide.shiftDragRearrange (boolean, default true  — Shift+drag to rearrange panels)

(function () {
  "use strict";

  // ── CSS ──────────────────────────────────────────────────────────────────
  const styleEl = document.createElement("style");
  styleEl.id = "zenscroll-split-drag-style";
  document.head.appendChild(styleEl);

  function refreshStyle() {
    const hide = Services.prefs.getBoolPref("userscripts.tabslide.hideSplitHeader", true);
    styleEl.textContent =
      (hide ? `.zen-view-splitter-header-container { display: none !important; }\n` : ``) +
      `.zenscroll-capture-overlay {
        position: absolute; inset: 0; z-index: 500;
        cursor: default; background: transparent;
        border-radius: var(--zen-native-inner-radius, 8px);
      }
      .zenscroll-capture-overlay.grab-ready { cursor: grab; }
      .zenscroll-capture-overlay.grabbing   { cursor: grabbing; }
      .zenscroll-drag-highlight {
        position: absolute; inset: 0; z-index: 501; pointer-events: none;
        display: none;
        border: 3px solid var(--zen-active-split-outline-color, var(--zen-primary-color, #7c3aed));
        border-radius: var(--zen-native-inner-radius, 8px);
        background: color-mix(in srgb, var(--zen-active-split-outline-color, var(--zen-primary-color, #7c3aed)) 25%, transparent);
        box-sizing: border-box;
      }`;
  }
  refreshStyle();
  Services.prefs.addObserver("userscripts.tabslide.hideSplitHeader", refreshStyle);

  // ── Shift+drag rearrange ─────────────────────────────────────────────────
  const DRAG_THRESHOLD = 6; // px before drag is committed
  let dragState = null;
  let shiftHeld  = false;

  function splitPanels() {
    return document.querySelectorAll('.browserSidebarContainer[zen-split="true"]');
  }

  function splitContainerOf(el) {
    return el?.closest('.browserSidebarContainer[zen-split="true"]') ?? null;
  }

  function tabForContainer(container) {
    const br = container?.querySelector("browser");
    return br ? (gBrowser.getTabForBrowser(br) ?? null) : null;
  }

  // Create (or return existing) overlay/highlight child element
  function ensureChild(container, cls) {
    let el = container.querySelector("." + cls);
    if (!el) {
      el = document.createElement("div");
      el.className = cls;
      container.appendChild(el);
    }
    return el;
  }

  function setHighlight(container, on) {
    if (!container) return;
    if (on) {
      ensureChild(container, "zenscroll-drag-highlight").style.display = "block";
    } else {
      const h = container.querySelector(".zenscroll-drag-highlight");
      if (h) h.style.display = "none";
    }
  }

  function addOverlays() {
    if (!Services.prefs.getBoolPref("userscripts.tabslide.shiftDragRearrange", true)) return;
    for (const p of splitPanels()) ensureChild(p, "zenscroll-capture-overlay");
  }

  function removeOverlays() {
    document.querySelectorAll(".zenscroll-capture-overlay").forEach(el => el.remove());
  }

  function cleanupDrag(cancelledByKey) {
    if (!dragState) return;
    const { srcContainer, dstContainer } = dragState;
    srcContainer.style.opacity = "";
    srcContainer.querySelector(".zenscroll-capture-overlay")?.classList.remove("grabbing", "grab-ready");
    setHighlight(srcContainer, false);
    if (dstContainer) setHighlight(dstContainer, false);
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("mouseup",   onUp,   true);
    dragState = null;
    if (!shiftHeld || cancelledByKey) removeOverlays();
  }

  function onMove(event) {
    if (!dragState) return;
    const s = dragState;

    if (!s.active) {
      if (Math.hypot(event.clientX - s.startX, event.clientY - s.startY) < DRAG_THRESHOLD) return;
      s.active = true;
      s.srcContainer.style.opacity = "0.55";
      const ov = s.srcContainer.querySelector(".zenscroll-capture-overlay");
      if (ov) { ov.classList.remove("grab-ready"); ov.classList.add("grabbing"); }
      setHighlight(s.srcContainer, true);
    }

    // Find which destination panel the cursor is over
    const el  = document.elementFromPoint(event.clientX, event.clientY);
    const dst = splitContainerOf(el);
    const newDst = (dst && dst !== s.srcContainer) ? dst : null;

    if (s.dstContainer !== newDst) {
      if (s.dstContainer) setHighlight(s.dstContainer, false);
      s.dstContainer = newDst;
      if (newDst) setHighlight(newDst, true);
    }
  }

  function onUp(event) {
    if (!dragState) return;
    const s = dragState;
    const wasActive    = s.active;
    const dstContainer = s.dstContainer;
    const srcContainer = s.srcContainer;
    cleanupDrag(false);

    if (!wasActive || !dstContainer) return;

    const splitter = window.gZenViewSplitter;
    if (!splitter || splitter.currentView < 0) return;

    const srcTab = tabForContainer(srcContainer);
    const dstTab = tabForContainer(dstContainer);
    if (!srcTab || !dstTab) return;

    const srcNode = splitter.getSplitNodeFromTab(srcTab);
    const dstNode = splitter.getSplitNodeFromTab(dstTab);
    if (!srcNode || !dstNode) return;

    // Determine drop side (center = swap, edge = split insert on that side)
    const dstBrowser = dstContainer.querySelector("browser");
    const hoverSide  = dstBrowser
      ? splitter.calculateHoverSide(event.clientX, event.clientY, dstBrowser.getBoundingClientRect())
      : "center";

    if (hoverSide === "center") {
      splitter.swapNodes(srcNode, dstNode);
      splitter.applyGridLayout(splitter._data[splitter.currentView].layoutTree);
    } else {
      splitter.removeNode(srcNode);
      splitter.splitIntoNode(dstNode, srcNode, hoverSide, 0.5);
      splitter.activateSplitView(splitter._data[splitter.currentView], true);
    }
  }

  function onDown(event) {
    if (event.button !== 0) return;
    if (!event.target.classList.contains("zenscroll-capture-overlay")) return;
    if (!Services.prefs.getBoolPref("userscripts.tabslide.shiftDragRearrange", true)) return;

    const container = splitContainerOf(event.target);
    if (!container) return;

    const splitter = window.gZenViewSplitter;
    if (!splitter || splitter.currentView < 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.target.classList.add("grab-ready");

    dragState = {
      srcContainer: container,
      dstContainer: null,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseup",   onUp,   true);
  }

  // Shift key: show / hide overlays
  document.addEventListener("keydown", event => {
    if (event.key !== "Shift" || shiftHeld) return;
    shiftHeld = true;
    addOverlays();
  }, true);

  document.addEventListener("keyup", event => {
    if (event.key !== "Shift") return;
    shiftHeld = false;
    if (!dragState?.active) removeOverlays();
  }, true);

  document.addEventListener("mousedown", onDown, true);

  // Also add overlays when new split panels appear while Shift is already held
  const panelsEl = document.getElementById("tabbrowser-tabpanels");
  if (panelsEl) {
    new MutationObserver(() => {
      if (shiftHeld) addOverlays();
    }).observe(panelsEl, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ["zen-split"],
    });
  }
})();
