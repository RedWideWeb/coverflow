/*
 * Bootstrap: wires keyboard -> navigation -> motion -> renderer and runs the
 * animation loop only while something is moving.
 */
(function (root) {
  'use strict';

  const { layout, motion, navigation, gesture, items, createRenderer, createTuner, bindPointer } = root.CoverFlow;

  const START_INDEX = 10; // "1 coin": covers on both sides to start with
  const MAX_FRAME_DT = 1 / 20; // s; avoids a jump after a backgrounded tab
  const RELEASE_LOOKAHEAD = 0.08; // s of momentum carried past a released scrub
  const reducedMotion = root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DEFAULTS = Object.freeze({
    camera: layout.CAMERA_DISTANCE,
    rest: layout.REST_POSE,
    fast: reducedMotion ? layout.REST_POSE : layout.FAST_POSE,
    motion: motion.MOTION,
    nav: navigation.NAV,
    gesture: gesture.GESTURE,
  });

  const stage = document.getElementById('stage');
  const renderer = createRenderer(stage, items);

  let config = DEFAULTS;
  let nav = navigation.create(items.length, START_INDEX);
  let phys = motion.create(nav.target);
  let frozen = null;
  let rafId = 0;
  let lastTime = 0;
  let heldArrows = new Set();
  let drag = null;
  let wheelTimer = 0;

  const tuner = createTuner({
    container: document.body,
    defaults: DEFAULTS,
    count: items.length,
    onConfig: (next) => {
      config = next;
      renderer.resize(config.camera);
      draw();
    },
    onFreeze: (next) => {
      frozen = next;
      draw();
    },
  });

  function draw() {
    const position = frozen ? frozen.position : phys.pos;
    const spread = frozen ? frozen.spread : phys.spread;
    const selected = frozen
      ? Math.min(Math.max(Math.round(frozen.position), 0), items.length - 1)
      : navigation.selectedIndex(nav);
    renderer.render({
      position,
      pose: layout.blendPose(config.rest, config.fast, spread),
      cameraDistance: config.camera,
      selected,
    });
    tuner.update({ pos: phys.pos, speed: phys.speed, spreadValue: phys.spread, target: nav.target });
  }

  const lastIndex = items.length - 1;
  const clampIndex = (value) => Math.min(Math.max(Math.round(value), 0), lastIndex);
  const dragPx = () => config.gesture.dragPxPerCover * renderer.coverSize();

  // While a finger or mouse is down the covers sit exactly where it puts
  // them; otherwise they chase the target on the spring.
  function followDrag(now, dt) {
    const pos = gesture.dragPosition(drag, dragPx(), items.length, config.gesture);
    const vel = gesture.dragVelocity(drag, dragPx(), now / 1000, config.gesture);
    phys = motion.track(phys, pos, vel, dt, config.motion);
    nav = navigation.jump(nav, clampIndex(pos));
  }

  function frame(now) {
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0), MAX_FRAME_DT);
    lastTime = now;
    if (drag) {
      followDrag(now, dt);
    } else {
      nav = navigation.advance(nav, dt, config.nav);
      phys = motion.step(phys, nav.target, dt, config.motion);
    }
    draw();
    const idle = !drag && nav.holdDir === 0 && motion.isSettled(phys, nav.target);
    rafId = idle ? 0 : root.requestAnimationFrame(frame);
  }

  function wake() {
    if (rafId) return;
    lastTime = root.performance.now();
    rafId = root.requestAnimationFrame(frame);
  }

  function applyMove({ state, bounced }, dir) {
    nav = state;
    if (bounced) phys = motion.kick(phys, dir * config.motion.bounceKick);
    wake();
  }

  const KEY_DIR = Object.freeze({ ArrowRight: 1, ArrowLeft: -1, PageDown: 1, PageUp: -1 });
  const isArrow = (key) => key === 'ArrowRight' || key === 'ArrowLeft';
  const isTuneKey = (key) => key === 't' || key === 'T';
  // Let a focused tuner slider keep its own arrow / Home / End behaviour.
  const isFormControl = (target) => target instanceof HTMLElement && target.closest('input, button, select, textarea');

  function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey || drag) return;
    if (isFormControl(event.target) && !isTuneKey(event.key)) return;
    const dir = KEY_DIR[event.key];
    if (isArrow(event.key)) {
      event.preventDefault();
      if (event.repeat) return; // holding is handled by navigation.advance
      heldArrows = new Set([...heldArrows, dir]);
      applyMove(event.shiftKey ? navigation.flick(nav, dir, config.nav) : navigation.press(nav, dir), dir);
    } else if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault();
      if (!event.repeat) applyMove(navigation.flick(nav, dir, config.nav), dir);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      nav = navigation.jump(nav, event.key === 'Home' ? 0 : items.length - 1);
      wake();
    } else if (isTuneKey(event.key)) {
      tuner.toggle();
      draw();
    }
  }

  function onKeyUp(event) {
    if (!isArrow(event.key)) return;
    const dir = KEY_DIR[event.key];
    heldArrows = new Set([...heldArrows].filter((d) => d !== dir));
    nav = navigation.release(nav, dir, phys.pos + phys.vel * RELEASE_LOOKAHEAD);
    if (nav.holdDir === 0 && heldArrows.has(-dir)) nav = navigation.hold(nav, -dir);
    wake();
  }

  function releaseHold() {
    heldArrows = new Set();
    if (nav.holdDir === 0) return;
    nav = navigation.release(nav, nav.holdDir, phys.pos + phys.vel * RELEASE_LOOKAHEAD);
    wake();
  }

  function onDragStart(x, t) {
    releaseHold();
    root.clearTimeout(wheelTimer);
    drag = gesture.startDrag(x, t, phys.pos);
    wake();
  }

  function onDragMove(x, t) {
    if (!drag) return;
    drag = gesture.moveDrag(drag, x, t, config.gesture);
    wake();
  }

  // A tap selects the cover under it (or just stops the flow); a drag hands
  // its position and velocity to the spring, aimed at the projected cover.
  function onDragEnd(x, t, hit) {
    if (!drag) return;
    const ended = gesture.moveDrag(drag, x, t, config.gesture);
    drag = null;
    const position = gesture.dragPosition(ended, dragPx(), items.length, config.gesture);
    if (gesture.isTap(ended, config.gesture)) {
      const cover = hit && hit.closest('.cover');
      nav = navigation.jump(nav, cover ? Number(cover.dataset.index) : clampIndex(position));
      wake();
      return;
    }
    const velocity = gesture.dragVelocity(ended, dragPx(), t, config.gesture);
    const target = gesture.flingTarget(position, velocity, items.length, config.gesture);
    nav = navigation.jump(nav, target);
    phys = motion.release(motion.track(phys, position, velocity, 0, config.motion), target, config.motion);
    wake();
  }

  // Mouse-wheel notches step like arrow taps; trackpad scrolling (OS momentum
  // included) moves the target continuously and snaps once it goes quiet.
  function onWheel(event) {
    const wheel = gesture.wheelDelta(event);
    if (wheel.dir === 0 || drag) return;
    if (wheel.discrete) {
      applyMove(navigation.step(nav, wheel.dir), wheel.dir);
      return;
    }
    nav = navigation.scrollBy(nav, wheel.px / (config.gesture.wheelPxPerCover * renderer.coverSize()));
    root.clearTimeout(wheelTimer);
    wheelTimer = root.setTimeout(() => {
      nav = navigation.jump(nav, gesture.wheelSnap(nav.target, wheel.dir, items.length, config.gesture));
      wake();
    }, config.gesture.wheelSettleDelay * 1000);
    wake();
  }

  bindPointer(stage, { onDragStart, onDragMove, onDragEnd, onWheel });
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('keyup', onKeyUp);
  root.addEventListener('blur', releaseHold);
  root.addEventListener('resize', () => {
    renderer.resize(config.camera);
    draw();
  });

  renderer.resize(config.camera);
  draw();
  stage.focus();
})(self);
