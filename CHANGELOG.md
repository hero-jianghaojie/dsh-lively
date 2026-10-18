# Changelog

## 0.2.1 — 2026-10-18

- **The wallpaper no longer lives on the root element.** Chromium paints
  `html`'s background into the canvas background layer and does not repaint it
  for `background-position`/`background-size` animations, so every preset looked
  static while its animation clock kept running. The wallpaper, veil and dim now
  sit as three children of `#dsh-lively-layer`.
- The pause-on-hidden rule targets the new surface (it used to point at `html`).
- A custom wallpaper URL is decoded (image `onload`, video `loadedmetadata`)
  before it is applied; a web page URL now shows an error instead of a blank
  canvas.
- The reduced-motion query became an **Animation** switch, so motion is a user
  choice rather than an OS side effect.
- Diagnostics report the surface's animation state (`animation.running`,
  `background-position`, `background-size`).

## 0.2.0 — 2026-10-18

- Playlist rotation across a chosen subset of presets (1–240 min, shuffle).
- Uploaded-wallpaper library (`/dsh-lively/library`) with thumbnails.
- New visibly animated **Flow** preset; the older presets drift faster.
- Wallpaper variants chosen with `:has(> body[data-ds-dark-theme])`.

## 0.1.0 — 2026-10-17

- First release: five presets, custom image/GIF/video wallpapers, strength/dim
  controls, pause on hidden, settings page, durable host state.
