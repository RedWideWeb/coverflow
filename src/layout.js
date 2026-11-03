/*
 * Cover Flow geometry. Pure functions, every distance is in cover-widths.
 *
 * Values were measured from IMG_0294.MOV: the edges of the AR-marker cells on
 * each side cover give its projective foreshortening, which pins down depth and
 * angle independently of where the phone camera was held.
 *
 *   camera        1.22 cover-widths in front of the centre cover
 *   rest pose     side covers turned a full 90deg (they read as corridor walls);
 *                 first wall plane 0.80 from centre, its near edge flush with
 *                 the centre cover, further walls every 0.215 at equal depth
 *   fast pose     centre recedes ~0.4 (renders at ~75% size) and the walls
 *                 fan open into a shallow concave arc, neighbour at ~30deg
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CoverFlow = Object.assign(root.CoverFlow || {}, { layout: api });
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CAMERA_DISTANCE = 1.22;

  // angle   rotation of a side cover once it has fully left the centre (deg)
  // inner   lateral offset of the first side cover's centre
  // spacing lateral step between further side covers
  // depth   how far the first side cover sits behind the centre plane
  // arc     per-cover forward drift beyond the first (> 0 makes the row concave)
  // recede  how far the whole row is pushed away from the camera
  const REST_POSE = Object.freeze({ angle: 90, inner: 0.8, spacing: 0.215, depth: 0.5, arc: 0, recede: 0 });
  const FAST_POSE = Object.freeze({ angle: 32, inner: 0.78, spacing: 0.34, depth: 0.12, arc: 0.07, recede: 0.42 });

  const VISIBLE_RANGE = 12;
  const MIN_NEAR_DEPTH = 0.15;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

  function blendPose(rest, fast, spread) {
    const t = clamp01(spread);
    return Object.freeze(
      Object.fromEntries(Object.keys(rest).map((key) => [key, lerp(rest[key], fast[key], t)]))
    );
  }

  // offset = item index minus the (fractional) scroll position.
  // Between 0 and +-1 a cover hinges from flat to its side angle; this linear
  // blend is what produces the V shape seen mid-flip in the video.
  function coverPose(offset, pose) {
    const distance = Math.abs(offset);
    const side = Math.sign(offset);
    const t = Math.min(distance, 1);
    const beyond = Math.max(distance - 1, 0);
    return Object.freeze({
      x: side * (pose.inner * t + pose.spacing * beyond),
      z: -pose.recede - pose.depth * t + pose.arc * beyond,
      rotateY: -side * pose.angle * t,
    });
  }

  // Closest point of the cover to the camera, measured along the view axis.
  function nearDepth(placement, cameraDistance) {
    const halfSwing = 0.5 * Math.abs(Math.sin((placement.rotateY * Math.PI) / 180));
    return cameraDistance - (placement.z + halfSwing);
  }

  function isVisible(offset, placement, cameraDistance) {
    return Math.abs(offset) <= VISIBLE_RANGE && nearDepth(placement, cameraDistance) > MIN_NEAR_DEPTH;
  }

  // Covers nearer the centre always paint on top; with the poses above the
  // side covers never interpenetrate, so this matches true depth order.
  function paintOrder(offset) {
    return Math.round(10000 - Math.abs(offset) * 100);
  }

  return Object.freeze({
    CAMERA_DISTANCE,
    REST_POSE,
    FAST_POSE,
    blendPose,
    coverPose,
    nearDepth,
    isVisible,
    paintOrder,
  });
});
