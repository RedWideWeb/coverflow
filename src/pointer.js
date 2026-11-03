/*
 * DOM binding for pointer (mouse, pen, touch) and wheel/trackpad input on the
 * stage. It only reports positions and times; gesture.js does the maths.
 */
(function (root) {
  'use strict';

  const seconds = (event) => event.timeStamp / 1000;

  function bindPointer(stage, { onDragStart, onDragMove, onDragEnd, onWheel }) {
    let activeId = null;

    stage.addEventListener('pointerdown', (event) => {
      if (activeId !== null || !event.isPrimary || event.button !== 0) return;
      activeId = event.pointerId;
      try {
        stage.setPointerCapture(event.pointerId);
      } catch (error) {
        // Capture only keeps the drag alive outside the window; without it the
        // full-screen stage still receives every move, so carry on.
        console.warn('Cover Flow: pointer capture unavailable', error);
      }
      stage.classList.add('is-dragging');
      onDragStart(event.clientX, seconds(event));
    });

    stage.addEventListener('pointermove', (event) => {
      if (event.pointerId !== activeId) return;
      // Coalesced samples give a steadier release velocity on fast pointers.
      const samples = event.getCoalescedEvents ? event.getCoalescedEvents() : [];
      (samples.length ? samples : [event]).forEach((e) => onDragMove(e.clientX, seconds(e)));
    });

    function end(event) {
      if (event.pointerId !== activeId) return;
      activeId = null;
      stage.classList.remove('is-dragging');
      const hit = event.type === 'pointerup' ? document.elementFromPoint(event.clientX, event.clientY) : null;
      onDragEnd(event.clientX, seconds(event), hit);
    }

    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    // Android long-press menu; a mouse right-click never starts a drag, so it
    // keeps its menu. (iOS's long-press loupe is stopped in CSS instead:
    // preventDefault on touchstart would also swallow iOS pointer events.)
    stage.addEventListener('contextmenu', (event) => {
      if (activeId !== null) event.preventDefault();
    });

    stage.addEventListener(
      'wheel',
      (event) => {
        if (event.ctrlKey) return; // trackpad pinch: leave browser zoom alone
        event.preventDefault();
        onWheel(event);
      },
      { passive: false }
    );
  }

  root.CoverFlow = Object.assign(root.CoverFlow || {}, { bindPointer });
})(self);
