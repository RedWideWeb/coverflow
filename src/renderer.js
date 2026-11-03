/*
 * DOM renderer. Every cover is absolutely positioned at the stage centre and
 * placed with perspective()/translate3d/rotateY. Each cover's transform-origin
 * is the centre of its art, which is the same screen point for all of them,
 * so a per-cover perspective() equals one shared camera with its vanishing
 * point on the horizon. (A parent `perspective-origin` was ignored by Safari
 * on real iPhones in portrait: the vanishing point fell to mid-screen and the
 * covers' bottom edges went flat.) Paint order comes from z-index rather than
 * preserve-3d depth sorting, which keeps Safari and Chrome identical.
 */
(function (root) {
  'use strict';

  const { layout } = root.CoverFlow;

  const COVER_HEIGHT_RATIO = 0.46; // of viewport height
  const COVER_WIDTH_RATIO = 0.3; // of viewport width
  const HORIZON_RATIO = 0.4; // cover centre, from the top of the viewport
  const CAPTION_GAP = 0.17; // below the cover, in cover sizes
  const CAPTION_FONT = 0.1; // in cover sizes (matches the video's big bold label)
  const CAPTION_FADE_MS = 160; // keep in sync with .caption__item transition
  // Floor reflection: alpha along its length, reaching zero at 58% of a cover.
  const REFLECTION_LENGTH = 0.58; // in cover sizes
  const REFLECTION_FADE = [[0, 0.42], [0.3 / REFLECTION_LENGTH, 0.12], [1, 0]];

  function createElement(tag, className, parent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (parent) parent.appendChild(el);
    return el;
  }

  // Paints the art and its fading floor reflection into one canvas, so each
  // cover is a single plain 3D-transformed element. A masked, flipped child
  // overflowing a rotated parent renders wrongly on real iPhones (reflections
  // and wall bottoms cut along a flat line), even though the Simulator is fine.
  function paintCover(canvas, image) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const length = Math.round(height * REFLECTION_LENGTH);
    const mirror = document.createElement('canvas');
    mirror.width = width;
    mirror.height = length;
    const m = mirror.getContext('2d');
    m.translate(0, height);
    m.scale(1, -1); // the art's bottom edge becomes the reflection's top row
    m.drawImage(image, 0, 0, width, height);
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'destination-in';
    const fade = m.createLinearGradient(0, 0, 0, length);
    REFLECTION_FADE.forEach(([at, alpha]) => fade.addColorStop(at, `rgba(0, 0, 0, ${alpha})`));
    m.fillStyle = fade;
    m.fillRect(0, 0, width, length);

    canvas.width = width;
    canvas.height = height + length;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);
    ctx.drawImage(mirror, 0, height);
  }

  function buildCover(item, index, parent) {
    const cover = createElement('div', 'cover', parent);
    cover.dataset.index = String(index);
    const canvas = createElement('canvas', 'cover__art', cover);
    canvas.setAttribute('aria-hidden', 'true');
    const image = new Image();
    image.addEventListener('load', () => paintCover(canvas, image));
    image.addEventListener('error', () => console.error(`Cover Flow: could not load ${item.image}`));
    image.src = item.image;
    return cover;
  }

  function buildCaption(item, parent) {
    const caption = createElement('div', 'caption__item', parent);
    createElement('div', 'caption__title', caption).textContent = item.title;
    createElement('div', 'caption__artist', caption).textContent = item.artist;
    return caption;
  }

  function measure(width, height) {
    const size = Math.round(Math.min(height * COVER_HEIGHT_RATIO, width * COVER_WIDTH_RATIO));
    const horizon = Math.round(height * HORIZON_RATIO);
    return { size, horizon, coverTop: horizon - size / 2 };
  }

  function createRenderer(stage, items) {
    const coversEl = stage.querySelector('.covers');
    const captionEl = stage.querySelector('.caption');
    const covers = items.map((item, index) => buildCover(item, index, coversEl));
    let metrics = measure(window.innerWidth, window.innerHeight);
    let shownIndex = -1;
    let activeCaption = null;

    function resize(cameraDistance) {
      metrics = measure(window.innerWidth, window.innerHeight);
      const { size, horizon, coverTop } = metrics;
      stage.style.setProperty('--cover-size', `${size}px`);
      stage.style.setProperty('--cover-height', `${(size * (1 + REFLECTION_LENGTH)).toFixed(1)}px`);
      stage.style.setProperty('--cover-top', `${coverTop}px`);
      stage.style.setProperty('--horizon', `${horizon}px`);
      stage.style.setProperty('--caption-top', `${Math.round(coverTop + size * (1 + CAPTION_GAP))}px`);
      stage.style.setProperty('--caption-font', `${(size * CAPTION_FONT).toFixed(1)}px`);
    }

    function placeCovers(position, pose, cameraDistance) {
      const { size } = metrics;
      const camera = `perspective(${(cameraDistance * size).toFixed(1)}px)`;
      covers.forEach((cover, index) => {
        const offset = index - position;
        const p = layout.coverPose(offset, pose);
        if (!layout.isVisible(offset, p, cameraDistance)) {
          cover.style.visibility = 'hidden';
          return;
        }
        cover.style.visibility = 'visible';
        cover.style.zIndex = String(layout.paintOrder(offset));
        cover.style.transform =
          `${camera} translate3d(${(p.x * size).toFixed(2)}px, 0, ${(p.z * size).toFixed(2)}px) ` +
          `rotateY(${p.rotateY.toFixed(3)}deg)`;
      });
    }

    // Each change gets its own caption node that fades in while the previous
    // ones fade out, so fast scrubbing double-exposes the labels the same way
    // the original does instead of snapping text mid-fade.
    function retireCaption(caption) {
      caption.classList.remove('is-active');
      const remove = () => caption.remove();
      caption.addEventListener('transitionend', remove, { once: true });
      setTimeout(remove, CAPTION_FADE_MS * 2); // in case no transition runs
    }

    function showCaption(index) {
      if (index === shownIndex) return;
      shownIndex = index;
      if (activeCaption) retireCaption(activeCaption);
      activeCaption = buildCaption(items[index], captionEl);
      void activeCaption.offsetWidth; // start from opacity 0 so the fade runs
      activeCaption.classList.add('is-active');
    }

    function render({ position, pose, cameraDistance, selected }) {
      placeCovers(position, pose, cameraDistance);
      showCaption(selected);
    }

    return Object.freeze({ resize, render, coverSize: () => metrics.size });
  }

  root.CoverFlow = Object.assign(root.CoverFlow || {}, { createRenderer });
})(self);
