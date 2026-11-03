/*
 * Pointer and wheel maths, no DOM. Distances are in screen px and converted
 * to covers with a px-per-cover scale supplied by the caller.
 *
 * Dragging keeps the centre cover under the finger; on release the recent
 * velocity is projected forward to pick the landing cover, and the spring in
 * motion.js takes over from that velocity. Trackpad scrolling moves the target
 * continuously and snaps once the events (including OS momentum) stop.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CoverFlow = Object.assign(root.CoverFlow || {}, { gesture: api });
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GESTURE = Object.freeze({
    dragPxPerCover: 0.8, // finger travel per cover, in cover sizes (matches the centre cover's slide)
    wheelPxPerCover: 0.8, // trackpad travel per cover, in cover sizes
    flingProjection: 0.4, // s of release velocity carried into the landing cover
    rubberBand: 0.35, // share of a pull past either end that still moves the flow
    maxOverscroll: 0.6, // covers, limit of that pull
    velocityWindow: 0.1, // s of pointer samples used for velocity
    staleAfter: 0.05, // s without movement before a held finger counts as stopped
    tapSlop: 6, // px; anything less is a tap
    wheelSettleDelay: 0.12, // s without wheel events before snapping to a cover
    wheelSnapBias: 0.2, // share of a cover past which a scroll commits to the next one
  });

  const DISCRETE_WHEEL_PX = 50; // a vertical-only delta this big is a mouse-wheel notch

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  function startDrag(x, t, position) {
    return Object.freeze({ originX: x, originPos: position, lastX: x, moved: 0, samples: Object.freeze([{ x, t }]) });
  }

  function moveDrag(drag, x, t, cfg) {
    const samples = [...drag.samples, { x, t }].filter((s) => t - s.t <= cfg.velocityWindow + 1e-9);
    const moved = Math.max(drag.moved, Math.abs(x - drag.originX));
    return Object.freeze({ ...drag, lastX: x, moved, samples: Object.freeze(samples) });
  }

  // Past either end the pull is resisted and tends toward maxOverscroll.
  function overscroll(distance, cfg) {
    return cfg.maxOverscroll * (1 - 1 / (1 + (distance * cfg.rubberBand) / cfg.maxOverscroll));
  }

  function rubberBand(position, count, cfg) {
    const last = count - 1;
    if (position < 0) return -overscroll(-position, cfg);
    if (position > last) return last + overscroll(position - last, cfg);
    return position;
  }

  function dragPosition(drag, pxPerCover, count, cfg) {
    const raw = drag.originPos - (drag.lastX - drag.originX) / pxPerCover;
    return rubberBand(raw, count, cfg);
  }

  // Covers per second; positive when the flow advances (finger moving left).
  function dragVelocity(drag, pxPerCover, now, cfg) {
    const first = drag.samples[0];
    const last = drag.samples[drag.samples.length - 1];
    const span = last.t - first.t;
    if (span <= 0 || now - last.t > cfg.staleAfter) return 0;
    return -(last.x - first.x) / span / pxPerCover;
  }

  function isTap(drag, cfg) {
    return drag.moved < cfg.tapSlop;
  }

  function flingTarget(position, velocity, count, cfg) {
    return clamp(Math.round(position + velocity * cfg.flingProjection), 0, count - 1);
  }

  // Dominant axis wins; deltaY > 0 (scroll down) and deltaX > 0 both advance.
  function wheelDelta({ deltaX, deltaY, deltaMode }) {
    const px = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    const discrete = deltaMode !== 0 || (deltaX === 0 && Math.abs(deltaY) >= DISCRETE_WHEEL_PX);
    return { discrete, dir: Math.sign(px), px };
  }

  function wheelSnap(target, dir, count, cfg) {
    const bias = 1 - cfg.wheelSnapBias;
    let index = Math.round(target);
    if (dir > 0) index = Math.floor(target + bias);
    else if (dir < 0) index = Math.ceil(target - bias);
    return clamp(index, 0, count - 1);
  }

  return Object.freeze({
    GESTURE,
    startDrag,
    moveDrag,
    dragPosition,
    dragVelocity,
    isTap,
    flingTarget,
    wheelDelta,
    wheelSnap,
  });
});
