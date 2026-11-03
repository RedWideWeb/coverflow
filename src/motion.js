/*
 * Scroll physics. The visual position chases the navigation target on a
 * critically damped spring (quick start, long ease-out, like the single flips
 * in the video). How fast it travels, smoothed over a short window, drives
 * `spread`: 0 keeps the covers at rest distance, 1 pushes them into the fast pose.
 * A lone flip peaks well below the onset speed, so only sustained or long
 * moves make the row recede.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CoverFlow = Object.assign(root.CoverFlow || {}, { motion: api });
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Fast-move timings from IMG_0296.MOV: a 16-cover swipe arrives in ~0.6 s
  // and the row is back at rest ~0.3-0.4 s after arriving.
  const MOTION = Object.freeze({
    stiffness: 16, // spring angular frequency, rad/s
    maxSpeed: 60, // items per second
    speedSmoothing: 0.06, // s, low-pass on |velocity|
    spreadOnset: 5, // items/s where the row starts to recede
    spreadFull: 14, // items/s for the full fast pose
    spreadAttack: 0.1, // s, time constant while speeding up
    spreadRelease: 0.13, // s, time constant while coming back
    bounceKick: 6, // items/s nudge when pressing past either end
    releaseMinSpeed: 8, // items/s; a slow drag release may still snap this fast
  });

  const MAX_SUBSTEP = 1 / 240;
  const POS_EPSILON = 1e-4;
  const VEL_EPSILON = 1e-3;
  const SPEED_EPSILON = 1e-4;
  const SPREAD_EPSILON = 2e-3; // < 0.001 cover-widths of recede, invisible

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  function smoothstep(edge0, edge1, value) {
    if (edge1 <= edge0) return value >= edge0 ? 1 : 0; // tuner can invert the edges
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // Exponential approach of `current` toward `goal` with time constant `tau`.
  function approach(current, goal, dt, tau, epsilon) {
    const next = goal + (current - goal) * Math.exp(-dt / tau);
    return Math.abs(next - goal) < epsilon ? goal : next;
  }

  // `cap` limits speed after a drag is released, so momentum never speeds up
  // after the finger lifts: { speed, target } or null.
  function create(pos) {
    return Object.freeze({ pos, vel: 0, speed: 0, spread: 0, cap: null });
  }

  function integrateSpring(pos, vel, target, dt, cfg, maxSpeed) {
    const steps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
    const h = dt / steps;
    const omega = cfg.stiffness;
    let p = pos;
    let v = vel;
    for (let i = 0; i < steps; i += 1) {
      const acc = omega * omega * (target - p) - 2 * omega * v;
      v = clamp(v + acc * h, -maxSpeed, maxSpeed);
      p += v * h;
    }
    const resting = Math.abs(target - p) < POS_EPSILON && Math.abs(v) < VEL_EPSILON;
    return resting ? { pos: target, vel: 0 } : { pos: p, vel: v };
  }

  function withSpread(state, pos, vel, cap, dt, cfg) {
    const speed = approach(state.speed, Math.abs(vel), dt, cfg.speedSmoothing, SPEED_EPSILON);
    const goal = smoothstep(cfg.spreadOnset, cfg.spreadFull, speed);
    const tau = goal > state.spread ? cfg.spreadAttack : cfg.spreadRelease;
    const spread = approach(state.spread, goal, dt, tau, SPREAD_EPSILON);
    return Object.freeze({ pos, vel, speed, spread, cap });
  }

  function step(state, target, dt, cfg) {
    const cap = state.cap && state.cap.target === target ? state.cap : null;
    const maxSpeed = cap ? Math.min(cfg.maxSpeed, cap.speed) : cfg.maxSpeed;
    const { pos, vel } = integrateSpring(state.pos, state.vel, target, dt, cfg, maxSpeed);
    const landed = pos === target && vel === 0;
    return withSpread(state, pos, vel, landed ? null : cap, dt, cfg);
  }

  // Direct manipulation: the position is wherever the finger put it, but the
  // speed still drives the same recede, so a fast drag pushes the row back.
  function track(state, pos, vel, dt, cfg) {
    return withSpread(state, pos, vel, null, dt, cfg);
  }

  // Finger lifted: the same spring takes the flow to `target`, starting from
  // the drag's velocity and never faster than it.
  function release(state, target, cfg) {
    const speed = Math.max(Math.abs(state.vel), cfg.releaseMinSpeed);
    return Object.freeze({ ...state, cap: Object.freeze({ speed, target }) });
  }

  function kick(state, impulse) {
    return Object.freeze({ ...state, vel: state.vel + impulse });
  }

  function isSettled(state, target) {
    return state.pos === target && state.vel === 0 && state.speed === 0 && state.spread === 0;
  }

  return Object.freeze({ MOTION, create, step, track, release, kick, isSettled });
});
