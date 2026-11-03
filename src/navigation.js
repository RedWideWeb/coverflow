/*
 * Keyboard navigation state. Decides *where* the flow should go; motion.js
 * decides how the covers get there.
 *
 * Tap an arrow to step one cover. Hold it and, after a short delay, the target
 * starts scrubbing and accelerates, which is what makes the row recede. On
 * release the scrub settles on the next whole cover in the direction of travel.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CoverFlow = Object.assign(root.CoverFlow || {}, { navigation: api });
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NAV = Object.freeze({
    holdDelay: 0.28, // s before a held arrow starts scrubbing
    scrubStartRate: 7, // items/s when scrubbing begins
    scrubMaxRate: 30, // items/s after the ramp (IMG_0296.MOV swipes travel ~30/s)
    scrubRamp: 1.2, // s to go from start rate to max rate
    flickDistance: 7, // items per Shift+arrow / Page key
  });

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const lastIndex = (state) => state.count - 1;
  const clampIndex = (state, index) => clamp(index, 0, lastIndex(state));

  function create(count, index) {
    const base = { count, target: 0, holdDir: 0, heldFor: 0, scrubbing: false };
    return Object.freeze({ ...base, target: clampIndex(base, Math.round(index)) });
  }

  function moveBy(state, delta, holdDir) {
    const from = Math.round(state.target);
    const target = clampIndex(state, from + delta);
    const next = Object.freeze({ ...state, target, holdDir, heldFor: 0, scrubbing: false });
    return { state: next, bounced: target === from };
  }

  function press(state, dir) {
    return moveBy(state, dir, dir);
  }

  // One cover, no hold (mouse-wheel notch).
  function step(state, dir) {
    return moveBy(state, dir, 0);
  }

  // Continuous scrolling (trackpad): fractional target, snapped later.
  function scrollBy(state, delta) {
    const target = clamp(state.target + delta, 0, lastIndex(state));
    return Object.freeze({ ...state, target, holdDir: 0, heldFor: 0, scrubbing: false });
  }

  function flick(state, dir, cfg = NAV) {
    return moveBy(state, dir * cfg.flickDistance, 0);
  }

  function jump(state, index) {
    return Object.freeze({ ...state, target: clampIndex(state, index), holdDir: 0, heldFor: 0, scrubbing: false });
  }

  // The scrub target runs ahead of the covers, so a release settles on the
  // next whole cover past `settleFrom` (where the covers are, plus a little
  // momentum), but never past the point the scrub had reached.
  function release(state, dir, settleFrom = state.target) {
    if (state.holdDir !== dir) return state;
    const settled = dir > 0
      ? Math.min(Math.ceil(settleFrom), Math.ceil(state.target))
      : Math.max(Math.floor(settleFrom), Math.floor(state.target));
    const target = state.scrubbing ? clampIndex(state, settled) : state.target;
    return Object.freeze({ ...state, target, holdDir: 0, heldFor: 0, scrubbing: false });
  }

  // Re-arm a key that is still physically down (e.g. after the opposite arrow
  // was tapped and released) without stepping again.
  function hold(state, dir) {
    return Object.freeze({ ...state, holdDir: dir, heldFor: 0, scrubbing: false });
  }

  function advance(state, dt, cfg = NAV) {
    if (state.holdDir === 0) return state;
    const heldFor = state.heldFor + dt;
    if (heldFor < cfg.holdDelay) return Object.freeze({ ...state, heldFor });
    const ramp = clamp((heldFor - cfg.holdDelay) / cfg.scrubRamp, 0, 1);
    const rate = cfg.scrubStartRate + (cfg.scrubMaxRate - cfg.scrubStartRate) * ramp;
    const target = clamp(state.target + state.holdDir * rate * dt, 0, lastIndex(state));
    return Object.freeze({ ...state, heldFor, scrubbing: true, target });
  }

  function selectedIndex(state) {
    return clampIndex(state, Math.round(state.target));
  }

  return Object.freeze({ NAV, create, press, step, scrollBy, flick, jump, release, hold, advance, selectedIndex });
});
