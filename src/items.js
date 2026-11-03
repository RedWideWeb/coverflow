/*
 * Library shown in the flow. The cover colours keep the on-screen order from
 * IMG_0294.MOV; titles and artists are made-up placeholders.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CoverFlow = Object.assign(root.CoverFlow || {}, { items: api });
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ALBUMS = [
    ['Ember Season', 'The Lantern Hours', 'Red'],
    ['Moss & Static', 'Juniper Vale', 'Green'],
    ['Midnight Ledger', 'Otto Krane', 'Black'],
    ['Shallow Water Radio', 'Coral Avenue', 'Cyan'],
    ['Blue Hour Postcards', 'Mira Solenne', 'Blue'],
    ['Glass Lagoon', 'The Tidal Club', 'Cyan'],
    ['Frost Signals', 'Nordlys Kids', 'Cyan'],
    ['Greenhouse Tapes', 'Fern & Wilder', 'Green'],
    ['Cinnamon Skyline', 'Ruby Calloway', 'Red'],
    ['Neon Orchard', 'Velvet Arcade', 'Magenta'],
    ['Pink Noise Parade', 'Lola Vance', 'Magenta'],
    ['Night Shift Hymns', 'The Quiet Engines', 'Black'],
    ['Violet Weather', 'Sable & Rose', 'Magenta'],
    ['Charcoal Sketches', 'Henrik Moll', 'Black'],
    ['Sunlight Algebra', 'Sunny Okafor', 'Yellow'],
    ['Brick Lane Echoes', 'Marlowe Street', 'Red'],
    ['Arctic Lullabies', 'Iris Halvorsen', 'Cyan'],
    ['Fuchsia Afterglow', 'Dmitri Laval', 'Magenta'],
  ];

  return Object.freeze(
    ALBUMS.map(([title, artist, colour]) => Object.freeze({ title, artist, image: `${colour}.png` }))
  );
});
