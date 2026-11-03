/*
 * Tuning panel (press T). Live sliders for the measured geometry and the
 * motion feel, plus a freeze mode to park the flow at any fractional position
 * and spread for side-by-side comparison with video frames.
 */
(function (root) {
  'use strict';

  const FIELDS = [
    { group: null, key: 'camera', label: 'Camera distance', min: 0.6, max: 3, step: 0.01 },
    { heading: 'Rest pose' },
    { group: 'rest', key: 'angle', label: 'Side angle', min: 0, max: 90, step: 1 },
    { group: 'rest', key: 'inner', label: 'First offset', min: 0.4, max: 1.6, step: 0.01 },
    { group: 'rest', key: 'spacing', label: 'Spacing', min: 0.05, max: 1, step: 0.005 },
    { group: 'rest', key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01 },
    { heading: 'Fast pose' },
    { group: 'fast', key: 'angle', label: 'Side angle', min: 0, max: 90, step: 1 },
    { group: 'fast', key: 'inner', label: 'First offset', min: 0.4, max: 1.6, step: 0.01 },
    { group: 'fast', key: 'spacing', label: 'Spacing', min: 0.05, max: 1, step: 0.005 },
    { group: 'fast', key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01 },
    { group: 'fast', key: 'arc', label: 'Concave arc', min: 0, max: 0.2, step: 0.005 },
    { group: 'fast', key: 'recede', label: 'Recede', min: 0, max: 1.5, step: 0.01 },
    { heading: 'Motion' },
    { group: 'motion', key: 'stiffness', label: 'Spring (rad/s)', min: 4, max: 40, step: 0.5 },
    { group: 'motion', key: 'maxSpeed', label: 'Max speed', min: 5, max: 120, step: 1 },
    { group: 'motion', key: 'speedSmoothing', label: 'Speed smoothing (s)', min: 0.01, max: 0.4, step: 0.01 },
    { group: 'motion', key: 'spreadOnset', label: 'Recede from (items/s)', min: 0, max: 20, step: 0.5 },
    { group: 'motion', key: 'spreadFull', label: 'Full recede at', min: 1, max: 40, step: 0.5 },
    { group: 'motion', key: 'spreadAttack', label: 'Recede attack (s)', min: 0.01, max: 1, step: 0.01 },
    { group: 'motion', key: 'spreadRelease', label: 'Recede release (s)', min: 0.01, max: 1.5, step: 0.01 },
    { heading: 'Drag & trackpad' },
    { group: 'gesture', key: 'dragPxPerCover', label: 'Drag per cover (× size)', min: 0.2, max: 2, step: 0.05 },
    { group: 'gesture', key: 'flingProjection', label: 'Flick carry (s)', min: 0, max: 1.2, step: 0.01 },
    { group: 'gesture', key: 'rubberBand', label: 'Edge resistance', min: 0.05, max: 1, step: 0.01 },
    { group: 'gesture', key: 'wheelPxPerCover', label: 'Scroll per cover (× size)', min: 0.2, max: 3, step: 0.05 },
    { group: 'gesture', key: 'wheelSettleDelay', label: 'Scroll snap delay (s)', min: 0.04, max: 0.5, step: 0.01 },
    { heading: 'Keyboard' },
    { group: 'nav', key: 'holdDelay', label: 'Hold delay (s)', min: 0.05, max: 1, step: 0.01 },
    { group: 'nav', key: 'scrubMaxRate', label: 'Scrub max rate', min: 2, max: 60, step: 1 },
    { group: 'nav', key: 'flickDistance', label: 'Flick distance', min: 2, max: 17, step: 1 },
  ];

  const getIn = (config, { group, key }) => (group ? config[group][key] : config[key]);
  const setIn = (config, { group, key }, value) =>
    group ? { ...config, [group]: { ...config[group], [key]: value } } : { ...config, [key]: value };

  function el(tag, attrs, parent, text) {
    const node = Object.assign(document.createElement(tag), attrs);
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  function slider(parent, { label, min, max, step, value, onInput }) {
    const row = el('label', { className: 'tuner__row' }, parent);
    el('span', { className: 'tuner__label' }, row, label);
    const input = el('input', { type: 'range', min, max, step, value }, row);
    const out = el('output', { className: 'tuner__value' }, row, String(value));
    input.addEventListener('input', () => {
      out.textContent = input.value;
      onInput(Number(input.value));
    });
    return { input, out };
  }

  function createTuner({ container, defaults, count, onConfig, onFreeze }) {
    let config = defaults;
    let freeze = { enabled: false, position: 0, spread: 0 };
    const panel = el('aside', { className: 'tuner', hidden: true }, container);
    el('h2', { className: 'tuner__title' }, panel, 'Tune  (T to close)');
    const readout = el('pre', { className: 'tuner__readout' }, panel);

    const inspect = el('fieldset', { className: 'tuner__group' }, panel);
    el('legend', {}, inspect, 'Inspect');
    const freezeRow = el('label', { className: 'tuner__row' }, inspect);
    const freezeBox = el('input', { type: 'checkbox' }, freezeRow);
    el('span', { className: 'tuner__label' }, freezeRow, 'Freeze at position / spread');
    const emitFreeze = () => onFreeze(freeze.enabled ? freeze : null);
    freezeBox.addEventListener('change', () => {
      freeze = { ...freeze, enabled: freezeBox.checked };
      emitFreeze();
    });
    const position = slider(inspect, {
      label: 'Position', min: 0, max: count - 1, step: 0.01, value: 0,
      onInput: (v) => { freeze = { ...freeze, position: v }; emitFreeze(); },
    });
    const spread = slider(inspect, {
      label: 'Spread', min: 0, max: 1, step: 0.01, value: 0,
      onInput: (v) => { freeze = { ...freeze, spread: v }; emitFreeze(); },
    });

    const controls = [];
    let group = panel;
    FIELDS.forEach((field) => {
      if (field.heading) {
        group = el('fieldset', { className: 'tuner__group' }, panel);
        el('legend', {}, group, field.heading);
        return;
      }
      const control = slider(group, {
        ...field,
        value: getIn(config, field),
        onInput: (v) => { config = setIn(config, field, v); onConfig(config); },
      });
      controls.push({ field, control });
    });

    const actions = el('div', { className: 'tuner__actions' }, panel);
    el('button', { type: 'button' }, actions, 'Reset').addEventListener('click', () => {
      config = defaults;
      controls.forEach(({ field, control }) => {
        control.input.value = getIn(config, field);
        control.out.textContent = String(getIn(config, field));
      });
      onConfig(config);
    });
    const copy = el('button', { type: 'button' }, actions, 'Copy JSON');
    copy.addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(config, null, 2)).then(
        () => { copy.textContent = 'Copied'; },
        () => { copy.textContent = 'Copy failed'; }
      );
      setTimeout(() => { copy.textContent = 'Copy JSON'; }, 1200);
    });

    // Closing the panel also lifts a freeze; otherwise the flow would look dead.
    function toggle() {
      panel.hidden = !panel.hidden;
      if (panel.hidden && freeze.enabled) {
        freezeBox.checked = false;
        freeze = { ...freeze, enabled: false };
        emitFreeze();
      }
    }

    function update({ pos, speed, spreadValue, target }) {
      if (panel.hidden) return;
      readout.textContent =
        `pos ${pos.toFixed(2)}  target ${target.toFixed(2)}\n` +
        `speed ${speed.toFixed(1)}/s  spread ${spreadValue.toFixed(2)}`;
      if (!freeze.enabled) {
        position.input.value = pos;
        position.out.textContent = pos.toFixed(2);
        spread.input.value = spreadValue;
        spread.out.textContent = spreadValue.toFixed(2);
        freeze = { ...freeze, position: pos, spread: spreadValue };
      }
    }

    return Object.freeze({ toggle, update, isOpen: () => !panel.hidden });
  }

  root.CoverFlow = Object.assign(root.CoverFlow || {}, { createTuner });
})(self);
