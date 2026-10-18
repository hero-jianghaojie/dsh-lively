// dsh-lively — browser half (client plugin bundle).
//
// Loaded by dsh-client-modules at /plugins/dsh-lively/client.js and executed
// through the vendored cordis Loader's lazy-CJS module table
// (window.__ModuleLoader__.load), the same shape the shipped ui-* packages
// and dsh-catppuccin emit.
//
// What it paints, and why it is built this way:
//   - The shell renders one root slot whose occupant is the three-column
//     AppFrame; every registered slot sits inside or above those columns, so
//     no slot can paint *behind* the frame. The wallpaper therefore lives in
//     one plugin-owned fixed layer at `z-index:-1`, appended to
//     <html> (a sibling of <body>, so the app's own body observers never see
//     it) and removed with the plugin's effect.
//   - The layer is invisible until the app's canvas becomes translucent. The
//     shell reads its canvas colour from `--dsw-alias-bg-base` (and the
//     sidebar from `--dsw-specific-sidebar-fill`), so the plugin overrides
//     exactly those two tokens with a `color-mix()` wash: wallpaper strength
//     is the transparency of that wash. Cards, menus and dialogs keep their
//     opaque layer tokens, so text never sits directly on moving pixels.
//   - Settings persist twice: localStorage (instant) and the Host route
//     `/dsh-lively/state` (durable across Desktop's per-launch random port).
window.__ModuleLoader__.load({
  id: 'dsh-lively',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const PLUGIN_ID = 'dsh-lively'
    const NS = 'settings.lively'
    const LS_KEY = 'dsh-lively:state:v1'
    const STATE_ROUTE = '/dsh-lively/state'
    const MEDIA_ROUTE = '/dsh-lively/media'
    const LIBRARY_ROUTE = '/dsh-lively/library'
    const MAX_MEDIA_BYTES = 96 * 1024 * 1024

    const PRESETS = [
      { id: 'flow', swatch: 'linear-gradient(135deg,#3b1f8f,#00c2ff 45%,#ff4d9d)' },
      { id: 'aurora', swatch: 'linear-gradient(135deg,#6d5dfc,#22d3c5 55%,#ff5f8f)' },
      { id: 'starfield', swatch: 'radial-gradient(120% 90% at 30% 20%,#2b3a67,#05060f 70%)' },
      { id: 'lava', swatch: 'linear-gradient(150deg,#ff6a00,#c2185b 55%,#2b0b12)' },
      { id: 'mesh', swatch: 'conic-gradient(from 200deg,#5b8cff,#ff8bd0,#7cf0c6,#5b8cff)' },
      { id: 'grid', swatch: 'linear-gradient(180deg,#05060f,#0b1230 60%,#2a0a3d)' },
    ]

    const DEFAULTS = {
      version: 1,
      enabled: true,
      mode: 'preset', // 'preset' | 'media'
      preset: 'aurora',
      mediaUrl: '',
      mediaKind: 'image', // 'image' | 'video'
      strength: 75, // 0..100 wallpaper visibility
      dim: 0, // 0..90 dark veil over the wallpaper
      blur: 10, // 0..24 px frost behind the columns and over video
      speed: 1, // 0.25..3 animation speed factor
      motion: true, // false stops every CSS animation (reduced-motion user choice)
      pauseOnHidden: true,
      rotate: {
        enabled: false,
        ids: ['aurora', 'starfield', 'mesh'],
        intervalMin: 10,
        shuffle: true,
      },
    }

    const zh = {
      'nav': '动态壁纸',
      'title': '动态壁纸',
      'subtitle': '在界面背后铺一层会动的壁纸：程序化预设、图片、GIF 或视频。面板保持半透明，文字始终可读。',
      'enable': '启用动态壁纸',
      'enableHint': '关闭后恢复原生不透明背景。',
      'presets': '内置预设',
      'presetsHint': '纯 CSS 绘制，不加载任何外部资源。',
      'preset.flow': '流光',
      'preset.aurora': '极光',
      'preset.starfield': '星空',
      'preset.lava': '熔岩',
      'preset.mesh': '网格渐变',
      'preset.grid': '霓虹网格',
      'media': '自定义壁纸',
      'mediaHint': '支持图片、GIF、WebP、AVIF、MP4、WebM。文件存到本机 DSH 目录，重启后仍保留。',
      'mediaUrl': '图片 / 视频地址',
      'mediaUrlPlaceholder': 'https://… 或选择本地文件',
      'applyUrl': '应用',
      'chooseFile': '选择文件…',
      'uploading': '上传中…',
      'removeMedia': '移除',
      'uploadFailed': '上传失败',
      'mediaUnreachable': '这个地址加载不成图片/视频（网页链接不能当壁纸）。',
      'unsupportedType': '不支持的文件类型',
      'tooLarge': '文件过大（上限 96 MB）',
      'currentMedia': '当前壁纸',
      'library': '已上传的壁纸',
      'strength': '壁纸强度',
      'strengthHint': '越大越透出壁纸，越小越接近原生底色。',
      'dim': '压暗',
      'dimHint': '壁纸越亮，调高它越容易看清文字。',
      'blur': '视频柔化',
      'blurHint': '只对视频壁纸生效：调高会把画面磨得更柔（预设壁纸是矢量渐变，不需要它）。',
      'speed': '速度',
      'speedHint': '预设动画的播放速度。',
      'motion': '动画',
      'motionHint': '关闭后所有预设动画停止，只保留静态渐变（适合晕动敏感或省电）。',
      'pause': '离开窗口时暂停',
      'pauseHint': '切到其他标签页或窗口时停住动画，省电。',
      'rotate': '轮换播放',
      'rotateHint': '每隔一段时间自动换一个内置预设，像桌面壁纸轮播。',
      'rotateEnable': '启用轮换',
      'rotateInterval': '切换间隔',
      'rotateShuffle': '随机顺序',
      'rotatePick': '参与轮换的预设',
      'rotateNeedsTwo': '至少选中两个预设才会轮换。',
      'minute': '分钟',
      'reset': '恢复默认',
      'on': '开',
      'off': '关',
    }

    const en = {
      'nav': 'Wallpaper',
      'title': 'Live wallpaper',
      'subtitle': 'An animated wallpaper layer behind the interface: procedural presets, images, GIF or video. Panels stay translucent and text stays readable.',
      'enable': 'Enable live wallpaper',
      'enableHint': 'Turning this off restores the native opaque background.',
      'presets': 'Built-in presets',
      'presetsHint': 'Drawn in pure CSS — no external assets are loaded.',
      'preset.flow': 'Flow',
      'preset.aurora': 'Aurora',
      'preset.starfield': 'Starfield',
      'preset.lava': 'Lava',
      'preset.mesh': 'Mesh',
      'preset.grid': 'Neon grid',
      'media': 'Custom wallpaper',
      'mediaHint': 'Images, GIF, WebP, AVIF, MP4 and WebM. Files are stored under the local DSH directory and survive a restart.',
      'mediaUrl': 'Image / video URL',
      'mediaUrlPlaceholder': 'https://… or choose a local file',
      'applyUrl': 'Apply',
      'chooseFile': 'Choose file…',
      'uploading': 'Uploading…',
      'removeMedia': 'Remove',
      'uploadFailed': 'Upload failed',
      'mediaUnreachable': 'That URL did not load as an image or video (a web page cannot be a wallpaper).',
      'unsupportedType': 'Unsupported file type',
      'tooLarge': 'File is too large (96 MB limit)',
      'currentMedia': 'Current wallpaper',
      'library': 'Uploaded wallpapers',
      'strength': 'Wallpaper strength',
      'strengthHint': 'Higher shows more wallpaper; lower stays closer to the native canvas colour.',
      'dim': 'Dim',
      'dimHint': 'Bright wallpapers read better with a higher dim.',
      'blur': 'Video softness',
      'blurHint': 'Applies to video wallpapers only; the presets are vector gradients and do not need it.',
      'speed': 'Speed',
      'speedHint': 'Animation speed of the presets.',
      'motion': 'Animation',
      'motionHint': 'Turning this off freezes every preset into a static gradient (motion sensitivity or battery).',
      'pause': 'Pause when the window is hidden',
      'pauseHint': 'Freezes the animation when the tab or window loses focus.',
      'rotate': 'Playlist',
      'rotateHint': 'Switch to another built-in preset every few minutes, like a wallpaper playlist.',
      'rotateEnable': 'Enable playlist',
      'rotateInterval': 'Switch every',
      'rotateShuffle': 'Shuffle',
      'rotatePick': 'Presets in the playlist',
      'rotateNeedsTwo': 'Pick at least two presets to rotate.',
      'minute': 'min',
      'reset': 'Reset to defaults',
      'on': 'On',
      'off': 'Off',
    }

    /* ------------------------------ state store ------------------------------ */

    let state = { ...DEFAULTS }
    const listeners = new Set()
    let notifyScheduled = false

    function emit() {
      if (notifyScheduled) return
      notifyScheduled = true
      Promise.resolve().then(() => {
        notifyScheduled = false
        for (const listener of listeners) {
          try {
            listener(state)
          } catch (error) {
            console.error('[dsh-lively] listener failed', error)
          }
        }
      })
    }

    function subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }

    function getState() {
      return state
    }

    /** Clamp + normalise whatever came back from storage or a form field. */
    function normalize(raw) {
      if (typeof raw !== 'object' || raw === null) return { ...DEFAULTS }
      const number = (value, min, max, fallback) => {
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return fallback
        return Math.min(max, Math.max(min, parsed))
      }
      const preset = PRESETS.some((entry) => entry.id === raw.preset) ? raw.preset : DEFAULTS.preset
      return {
        version: 1,
        enabled: raw.enabled !== false,
        mode: raw.mode === 'media' ? 'media' : 'preset',
        preset,
        mediaUrl: typeof raw.mediaUrl === 'string' ? raw.mediaUrl : '',
        mediaKind: raw.mediaKind === 'video' ? 'video' : 'image',
        strength: number(raw.strength, 0, 100, DEFAULTS.strength),
        dim: number(raw.dim, 0, 90, DEFAULTS.dim),
        blur: number(raw.blur, 0, 24, DEFAULTS.blur),
        speed: number(raw.speed, 0.25, 3, DEFAULTS.speed),
        motion: raw.motion !== false,
        pauseOnHidden: raw.pauseOnHidden !== false,
        rotate: {
          enabled: raw.rotate !== null && typeof raw.rotate === 'object' && raw.rotate.enabled === true,
          ids: Array.isArray(raw.rotate?.ids)
            ? raw.rotate.ids.filter((id) => PRESETS.some((entry) => entry.id === id))
            : [...DEFAULTS.rotate.ids],
          intervalMin: number(raw.rotate?.intervalMin, 1, 240, DEFAULTS.rotate.intervalMin),
          shuffle: raw.rotate?.shuffle !== false,
        },
      }
    }

    function readLocal() {
      try {
        const raw = window.localStorage.getItem(LS_KEY)
        if (typeof raw !== 'string') return null
        return normalize(JSON.parse(raw))
      } catch {
        return null
      }
    }

    function writeLocal() {
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(state))
      } catch {
        // storage unavailable / quota — the choice stays session-local
      }
    }

    /* -------------------------------- runtime -------------------------------- */

    const runtime = {
      style: null,
      layer: null,
      surface: null,
      video: null,
      imageUrl: '',
      colorBase: '#141418',
      colorSidebar: '',
      dark: true,
      t: (key) => key,
      flushTimer: null,
      ctx: null,
    }

    /**
     * The canvas wash is driven purely by `body[data-ds-dark-theme]`, the
     * attribute ui-layout's ThemePresenter maintains. Reading the token back
     * with getComputedStyle is NOT an option: the presenter applies its
     * inline tokens in its own effect, which can land after this plugin's
     * boot, and a value captured from a not-yet-themed body (or from our own
     * override) is exactly how a dark wash ends up on a light theme — the
     * "everything went black" failure. A fixed light/dark pair cannot be
     * wrong, and the attribute selector follows theme switches with no JS.
     */
    /**
     * The wallpaper is painted on the ROOT ELEMENT's background, not in a
     * positioned div. The root background is the canvas — the one surface
     * that is guaranteed to sit under every column — while a `z-index:-1`
     * div has to win a stacking-context fight that the shell does not
     * document. The translucent canvas tokens in surfaceCss() then let that
     * canvas show through the columns.
     *
     * Only video needs a real element (CSS cannot play a video), so the div
     * layer below exists solely for that case.
     */
    function presetCss() {
      return `
html {
  background-repeat: no-repeat !important;
  background-position: center !important;
  background-size: cover !important;
}

html[data-dsh-lively-preset]::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-color: rgb(248 248 250 / var(--dsh-lively-veil, 0.2));
}
html:has(> body[data-ds-dark-theme])[data-dsh-lively-preset]::before {
  background-color: rgb(14 15 18 / var(--dsh-lively-veil, 0.2));
}
html[data-dsh-lively-preset]::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-color: rgb(0 0 0 / var(--dsh-lively-dim, 0));
}

html[data-dsh-lively-preset='flow'] {
  background-image:
    radial-gradient(46% 44% at 22% 28%, #6d5dfc 0%, rgba(109, 93, 252, 0) 62%),
    radial-gradient(42% 42% at 78% 26%, #00c2ff 0%, rgba(0, 194, 255, 0) 60%),
    radial-gradient(52% 48% at 64% 78%, #ff4d9d 0%, rgba(255, 77, 157, 0) 64%),
    linear-gradient(160deg, #070b18, #101b33) !important;
  background-size: 150% 150% !important;
  animation: dsh-lively-flow calc(16s / var(--dsh-lively-speed, 1)) ease-in-out infinite !important;
}

html[data-dsh-lively-preset='aurora'] {
  background-image:
    radial-gradient(42% 34% at 22% 28%, #7c6cff 0%, rgba(124, 108, 255, 0) 62%),
    radial-gradient(38% 30% at 74% 22%, #22d3c5 0%, rgba(34, 211, 197, 0) 60%),
    radial-gradient(46% 38% at 62% 78%, #ff5f8f 0%, rgba(255, 95, 143, 0) 64%),
    radial-gradient(40% 32% at 28% 84%, #4f8cff 0%, rgba(79, 140, 255, 0) 60%),
    linear-gradient(160deg, #0a0e1c, #121a33) !important;
  background-size: 175% 175% !important;
  animation: dsh-lively-pan calc(26s / var(--dsh-lively-speed, 1)) ease-in-out infinite alternate !important;
}

html[data-dsh-lively-preset='starfield'] {
  background-color: #05060f !important;
  background-image:
    radial-gradient(1.4px 1.4px at 24px 36px, rgba(255, 255, 255, 0.95), transparent 55%),
    radial-gradient(1.1px 1.1px at 120px 84px, rgba(190, 214, 255, 0.9), transparent 55%),
    radial-gradient(1.7px 1.7px at 68px 150px, rgba(255, 255, 255, 0.8), transparent 55%),
    radial-gradient(120% 90% at 70% 20%, rgba(78, 52, 148, 0.55), transparent 62%),
    radial-gradient(90% 70% at 20% 80%, rgba(16, 96, 128, 0.4), transparent 60%) !important;
  background-size: 220px 220px, 340px 340px, 460px 460px, 100% 100%, 100% 100% !important;
  animation: dsh-lively-stars calc(70s / var(--dsh-lively-speed, 1)) linear infinite !important;
}

html[data-dsh-lively-preset='lava'] {
  background-image:
    radial-gradient(38% 30% at 30% 70%, #ff8a00 0%, rgba(255, 138, 0, 0) 58%),
    radial-gradient(34% 28% at 68% 62%, #ff2d55 0%, rgba(255, 45, 85, 0) 58%),
    radial-gradient(46% 36% at 52% 88%, #ffb703 0%, rgba(255, 183, 3, 0) 60%),
    linear-gradient(170deg, #23070c, #3a0c10 45%, #120306) !important;
  background-size: 170% 170% !important;
  animation: dsh-lively-pan calc(18s / var(--dsh-lively-speed, 1)) ease-in-out infinite alternate-reverse !important;
}

html[data-dsh-lively-preset='mesh'] {
  background-image:
    radial-gradient(48% 42% at 18% 24%, #5b8cff 0%, rgba(91, 140, 255, 0) 62%),
    radial-gradient(44% 40% at 78% 30%, #ff8bd0 0%, rgba(255, 139, 208, 0) 62%),
    radial-gradient(52% 44% at 62% 82%, #7cf0c6 0%, rgba(124, 240, 198, 0) 64%),
    radial-gradient(40% 36% at 22% 78%, #b388ff 0%, rgba(179, 136, 255, 0) 62%),
    linear-gradient(140deg, #0b0f22, #141a33) !important;
  background-size: 185% 185% !important;
  animation: dsh-lively-pan calc(30s / var(--dsh-lively-speed, 1)) ease-in-out infinite alternate !important;
}

html[data-dsh-lively-preset='grid'] {
  background-color: #05060f !important;
  background-image:
    repeating-linear-gradient(90deg, rgba(120, 200, 255, 0.26) 0 1px, transparent 1px 64px),
    repeating-linear-gradient(0deg, rgba(120, 200, 255, 0.2) 0 1px, transparent 1px 64px),
    radial-gradient(62% 44% at 50% 102%, rgba(255, 60, 160, 0.4), transparent 70%),
    linear-gradient(180deg, #05060f, #0b1230 62%, #1b0a2e) !important;
  background-size: 64px 64px, 64px 64px, 100% 100%, 100% 100% !important;
  animation: dsh-lively-grid calc(9s / var(--dsh-lively-speed, 1)) linear infinite !important;
}

html[data-dsh-lively-preset='media'] {
  background-image: var(--dsh-lively-image, none) !important;
  background-size: cover !important;
  background-position: center !important;
  background-color: #05060b !important;
}

/* Light palette: the same five looks, redrawn bright. A dark wallpaper under a
   white wash can only ever be gray, which is what "better but not enough"
   looked like; these variants keep real colour at high wallpaper strength. */
html:has(> body:not([data-ds-dark-theme]))[data-dsh-lively-preset='flow'] {
  background-image:
    radial-gradient(46% 44% at 22% 28%, #b9a7ff 0%, rgba(185, 167, 255, 0) 62%),
    radial-gradient(42% 42% at 78% 26%, #7fe8ff 0%, rgba(127, 232, 255, 0) 60%),
    radial-gradient(52% 48% at 64% 78%, #ffb3d4 0%, rgba(255, 179, 212, 0) 64%),
    linear-gradient(160deg, #f3f1ff, #eafaff) !important;
  background-size: 150% 150% !important;
}

html:has(> body:not([data-ds-dark-theme]))[data-dsh-lively-preset='aurora'] {
  background-image:
    radial-gradient(42% 34% at 22% 28%, #b9a7ff 0%, rgba(185, 167, 255, 0) 62%),
    radial-gradient(38% 30% at 74% 22%, #7ff0dc 0%, rgba(127, 240, 220, 0) 60%),
    radial-gradient(46% 38% at 62% 78%, #ffb3cf 0%, rgba(255, 179, 207, 0) 64%),
    radial-gradient(40% 32% at 28% 84%, #a9c6ff 0%, rgba(169, 198, 255, 0) 60%),
    linear-gradient(160deg, #f6f3ff, #eaf6ff) !important;
  background-size: 175% 175% !important;
}
html:has(> body:not([data-ds-dark-theme]))[data-dsh-lively-preset='starfield'] {
  background-color: #eef4ff !important;
  background-image:
    radial-gradient(1.4px 1.4px at 24px 36px, rgba(90, 110, 160, 0.5), transparent 55%),
    radial-gradient(1.1px 1.1px at 120px 84px, rgba(120, 140, 190, 0.45), transparent 55%),
    radial-gradient(1.7px 1.7px at 68px 150px, rgba(80, 100, 150, 0.4), transparent 55%),
    radial-gradient(120% 90% at 70% 20%, rgba(150, 130, 240, 0.28), transparent 62%),
    radial-gradient(90% 70% at 20% 80%, rgba(90, 190, 230, 0.3), transparent 60%) !important;
  background-size: 220px 220px, 340px 340px, 460px 460px, 100% 100%, 100% 100% !important;
}
html:has(> body:not([data-ds-dark-theme]))[data-dsh-lively-preset='lava'] {
  background-image:
    radial-gradient(38% 30% at 30% 70%, #ffc27a 0%, rgba(255, 194, 122, 0) 58%),
    radial-gradient(34% 28% at 68% 62%, #ff9db0 0%, rgba(255, 157, 176, 0) 58%),
    radial-gradient(46% 36% at 52% 88%, #ffe6a3 0%, rgba(255, 230, 163, 0) 60%),
    linear-gradient(170deg, #fff5ec, #ffeef0 45%, #fff8ea) !important;
  background-size: 170% 170% !important;
}
html:has(> body:not([data-ds-dark-theme]))[data-dsh-lively-preset='mesh'] {
  background-image:
    radial-gradient(48% 42% at 18% 24%, #b7ccff 0%, rgba(183, 204, 255, 0) 62%),
    radial-gradient(44% 40% at 78% 30%, #ffc2e2 0%, rgba(255, 194, 226, 0) 62%),
    radial-gradient(52% 44% at 62% 82%, #b9f5dd 0%, rgba(185, 245, 221, 0) 64%),
    radial-gradient(40% 36% at 22% 78%, #d9c6ff 0%, rgba(217, 198, 255, 0) 62%),
    linear-gradient(140deg, #f6f7ff, #f2f6ff) !important;
  background-size: 185% 185% !important;
}
html:has(> body:not([data-ds-dark-theme]))[data-dsh-lively-preset='grid'] {
  background-color: #f4f3ff !important;
  background-image:
    repeating-linear-gradient(90deg, rgba(120, 110, 230, 0.18) 0 1px, transparent 1px 64px),
    repeating-linear-gradient(0deg, rgba(120, 110, 230, 0.14) 0 1px, transparent 1px 64px),
    radial-gradient(62% 44% at 50% 102%, rgba(255, 120, 190, 0.25), transparent 70%),
    linear-gradient(180deg, #f7f5ff, #eef2ff 62%, #fdf0ff) !important;
  background-size: 64px 64px, 64px 64px, 100% 100%, 100% 100% !important;
}

/* No backdrop-filter on the columns. filter/backdrop-filter make an
   element the containing block for fixed-position descendants, and the
   sidebar's fold toggle is 'position: fixed; left: 12px; top: (titlebar-28)/2'
   — blurring the column pulled that button out of the window chrome and
   stacked it on the brand mark. The veil alone keeps the look. */

html[data-dsh-lively-paused='true'] {
  animation-play-state: paused !important;
}

@keyframes dsh-lively-flow {
  0% { background-position: 0% 50%; background-size: 150% 150%; }
  35% { background-position: 70% 20%; background-size: 190% 190%; }
  70% { background-position: 100% 85%; background-size: 165% 165%; }
  100% { background-position: 0% 50%; background-size: 150% 150%; }
}
@keyframes dsh-lively-pan {
  from { background-position: 0% 45%; }
  to { background-position: 100% 55%; }
}
@keyframes dsh-lively-stars {
  from { background-position: 0 0, 0 0, 0 0, 0 0, 0 0; }
  to { background-position: -220px 440px, 340px -680px, -460px -460px, 0 0, 0 0; }
}
@keyframes dsh-lively-grid {
  from { background-position: 0 0, 0 0, 0 0, 0 0; }
  to { background-position: 0 64px, 0 64px, 0 0, 0 0; }
}

#dsh-lively-layer {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  contain: strict;
}
#dsh-lively-layer > video.dsh-lively-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
#dsh-lively-layer[data-blur='on'] > video.dsh-lively-video {
  filter: blur(var(--dsh-lively-blur, 0px));
}

/* The animation switch is a user setting rather than a bare
   prefers-reduced-motion query: a wallpaper whose only motion is a slow
   gradient still reads as "static", and the user asked for motion. Turning
   the switch off is the reduced-motion escape hatch. */
html[data-dsh-lively-motion='off'][data-dsh-lively-preset] {
  animation: none !important;
}
`
    }

    /**
     * The token overrides that let the wallpaper through the shell.
     *
     * `--dsh-lively-veil` is the opacity of the canvas wash (1 - strength),
     * written on <html> by syncLayerVars(). The two literal colours are the
     * only theme-dependent values: white for the light palette, near-black
     * for the dark one. They deliberately do NOT mirror the exact palette
     * colour — a wash that is merely close still reads as the app's own
     * canvas, while a wash captured from the wrong state reads as a black
     * screen.
     */
    function surfaceCss() {
      return `
body {
  background-color: transparent !important;
}
/* The frame paints --dsw-alias-bg-base once for the whole window and the
   centre column paints it again, so any alpha in that token multiplies
   (0.62 * 0.62 ≈ 0.86 opaque). The token is therefore fully transparent and
   the one theme-coloured veil lives in the canvas pseudo-elements above,
   painted exactly once. */
[class$='_frame'],
[class$='_frame']::before {
  background: transparent !important;
}
body:not([data-ds-dark-theme]) {
  --dsw-alias-bg-base: transparent !important;
  --dsw-specific-sidebar-fill: transparent !important;
}
body[data-ds-dark-theme] {
  --dsw-alias-bg-base: transparent !important;
  --dsw-specific-sidebar-fill: transparent !important;
}
`
    }

    function buildCss() {
      if (!state.enabled) return ''
      return presetCss() + surfaceCss()
    }

    let sheetEnabled = null

    /**
     * The sheet only depends on whether the wallpaper is on: presets and the
     * wash are all attribute/token driven. Re-writing textContent on every
     * slider tick would restart every CSS animation and re-parse the whole
     * sheet, so the text is rebuilt only when the on/off state flips.
     */
    function applyCss(force) {
      if (runtime.style === null) return
      if (force === true || sheetEnabled !== state.enabled) {
        runtime.style.textContent = buildCss()
        sheetEnabled = state.enabled
      }
      syncLayerVars()
    }

    /** Keep the canvas preset and the video layer in sync with the state. */
    function syncLayer() {
      const root = document.documentElement
      if (!state.enabled) {
        root.removeAttribute('data-dsh-lively-preset')
        root.removeAttribute('data-dsh-lively-tone')
        root.style.removeProperty('--dsh-lively-image')
        teardownVideo()
        teardownLayer()
        return
      }
      const isMedia = state.mode === 'media' && state.mediaUrl !== ''
      if (isMedia && state.mediaKind === 'video') {
        if (root.getAttribute('data-dsh-lively-preset') !== 'video') {
          root.setAttribute('data-dsh-lively-preset', 'video')
        }
        root.style.removeProperty('--dsh-lively-image')
        ensureLayer()
        ensureVideo(state.mediaUrl)
        return
      }
      // Preset or image: the canvas carries it, no element of ours is needed.
      if (runtime.video !== null) teardownVideo()
      if (runtime.layer !== null) teardownLayer()
      if (isMedia) {
        root.setAttribute('data-dsh-lively-preset', 'media')
        const image = `url("${state.mediaUrl}")`
        if (root.style.getPropertyValue('--dsh-lively-image') !== image) {
          root.style.setProperty('--dsh-lively-image', image)
        }
      } else {
        root.style.removeProperty('--dsh-lively-image')
        if (root.getAttribute('data-dsh-lively-preset') !== state.preset) {
          root.setAttribute('data-dsh-lively-preset', state.preset)
        }
      }
    }

    function ensureLayer() {
      if (runtime.layer !== null && runtime.layer.isConnected) {
        syncLayerVars()
        return
      }
      const layer = document.createElement('div')
      layer.id = 'dsh-lively-layer'
      layer.setAttribute('aria-hidden', 'true')
      document.documentElement.appendChild(layer)
      runtime.layer = layer
      syncLayerVars()
    }

    function teardownLayer() {
      if (runtime.layer === null) return
      runtime.layer.remove()
      runtime.layer = null
    }

    function ensureVideo(url) {
      if (runtime.video !== null && runtime.video.isConnected) {
        if (runtime.video.getAttribute('src') !== url) {
          runtime.video.setAttribute('src', url)
          runtime.video.load()
        }
        return
      }
      teardownVideo()
      const video = document.createElement('video')
      video.className = 'dsh-lively-video'
      video.muted = true
      video.loop = true
      video.autoplay = true
      video.setAttribute('playsinline', '')
      video.setAttribute('aria-hidden', 'true')
      video.setAttribute('src', url)
      runtime.layer.appendChild(video)
      runtime.video = video
      syncPlayback()
    }

    function teardownVideo() {
      if (runtime.video === null) return
      try {
        runtime.video.pause()
      } catch {
        // already detached
      }
      runtime.video.remove()
      runtime.video = null
    }

    function teardownMedia() {
      teardownVideo()
      teardownLayer()
    }

    function syncLayerVars() {
      const root = document.documentElement
      const veil = Math.min(1, Math.max(0, (100 - Number(state.strength || 0)) / 100))
      // CSS no longer keys the light/dark variants on this attribute (it uses
      // :has(> body[data-ds-dark-theme])), so a wrong guess at boot cannot
      // flip the wallpaper any more; the attribute is kept for diagnostics.
      const dark = document.body !== null && document.body.hasAttribute('data-ds-dark-theme')
      root.setAttribute('data-dsh-lively-tone', dark ? 'dark' : 'light')
      root.setAttribute('data-dsh-lively-motion', state.motion === false ? 'off' : 'on')
      root.style.setProperty('--dsh-lively-speed', String(state.speed))
      root.style.setProperty('--dsh-lively-dim', String(state.dim / 100))
      root.style.setProperty('--dsh-lively-blur', `${state.blur}px`)
      root.style.setProperty('--dsh-lively-veil', String(veil))
      root.style.setProperty('--dsh-lively-veil-strong', String(Math.min(1, veil + 0.06)))
      if (runtime.layer !== null) runtime.layer.setAttribute('data-blur', state.blur > 0 ? 'on' : 'off')
    }

    function syncPlayback() {
      const hidden = typeof document.hidden === 'boolean' ? document.hidden : false
      const paused = state.enabled && state.pauseOnHidden && hidden
      document.documentElement.setAttribute('data-dsh-lively-paused', paused ? 'true' : 'false')
      if (runtime.video !== null) {
        if (paused) {
          try {
            runtime.video.pause()
          } catch {
            // ignore
          }
        } else {
          const played = runtime.video.play()
          if (played && typeof played.catch === 'function') played.catch(() => {})
        }
      }
    }

    /* ------------------------------ playlist timer ---------------------------- */

    let rotateTimer = null

    function stopRotation() {
      if (rotateTimer === null) return
      clearTimeout(rotateTimer)
      rotateTimer = null
    }

    /**
     * One setTimeout per switch rather than setInterval: every state change
     * (including a manual preset click) restarts the countdown, so a playlist
     * never switches right after the user picked something themselves.
     */
    function scheduleRotation() {
      stopRotation()
      const rotate = state.rotate
      if (!state.enabled || rotate === undefined || rotate.enabled !== true) return
      const ids = rotate.ids.filter((id) => PRESETS.some((entry) => entry.id === id))
      if (ids.length < 2) return
      const intervalMs = Math.max(1, Number(rotate.intervalMin) || 10) * 60_000
      rotateTimer = setTimeout(() => {
        rotateTimer = null
        const current = state.preset
        let next = current
        if (rotate.shuffle) {
          const candidates = ids.filter((id) => id !== current)
          next = candidates[Math.floor(Math.random() * candidates.length)]
        } else {
          next = ids[(ids.indexOf(current) + 1) % ids.length]
        }
        if (typeof next === 'string' && next !== current) update({ mode: 'preset', preset: next })
        scheduleRotation()
      }, intervalMs)
    }

    function flushState() {
      if (runtime.flushTimer !== null) clearTimeout(runtime.flushTimer)
      runtime.flushTimer = setTimeout(() => {
        runtime.flushTimer = null
        writeLocal()
        fetch(STATE_ROUTE, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(lastDiag === null ? state : { ...state, diag: lastDiag }),
        }).catch(() => {
          // best effort: localStorage still holds the choice
        })
      }, 400)
    }

    function update(patch) {
      state = normalize({ ...state, ...patch })
      applyCss()
      syncLayer()
      syncPlayback()
      emit()
      flushState()
      scheduleDiagnostics()
      scheduleRotation()
    }

    /* ------------------------------- diagnostics ------------------------------ */

    let diagTimers = []
    let lastDiag = null

    function scheduleDiagnostics() {
      for (const timer of diagTimers) clearTimeout(timer)
      // Three samples: right after boot, once the first paint settled, and
      // late enough to catch the normal view if Settings was open at boot.
      diagTimers = [1500, 6000, 15000].map((delay) =>
        setTimeout(() => {
          reportDiagnostics()
        }, delay),
      )
    }

    /**
     * Diagnostics are written into the same Host state file (`diag` is not a
     * state field, so normalize() drops it on the way back in). Each sample
     * carries both the hit stack and the full ancestor chain: the surface that
     * hides the wallpaper is usually an ancestor, not the element under the
     * pointer.
     */
    function collectDiagnostics() {
      const root = document.documentElement
      const body = document.body
      const bodyStyle = body ? window.getComputedStyle(body) : null
      const htmlStyle = window.getComputedStyle(root)
      const describe = (el) => {
        const style = window.getComputedStyle(el)
        const cls = String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.')
        const image = String(style.backgroundImage || '')
        return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''} bg=${style.backgroundColor} img=${image === 'none' ? '-' : image.slice(0, 32)} pos=${style.position} z=${style.zIndex} op=${style.opacity}`
      }
      const sample = (xr, yr) => {
        try {
          const x = Math.round(window.innerWidth * xr)
          const y = Math.round(window.innerHeight * yr)
          const stack = (document.elementsFromPoint(x, y) || []).slice(0, 6).map(describe)
          // Walk every ancestor of the topmost element: the opaque surface that
          // hides the wallpaper is usually an ancestor, not the element itself.
          const chain = []
          let node = document.elementFromPoint(x, y)
          for (let i = 0; node !== null && i < 16; i += 1, node = node.parentElement) {
            chain.push(describe(node))
          }
          return { stack, chain }
        } catch (error) {
          return { stack: [`sample failed: ${error instanceof Error ? error.message : String(error)}`], chain: [] }
        }
      }
      return {
        at: new Date().toISOString(),
        dark: body ? body.hasAttribute('data-ds-dark-theme') : null,
        preset: root.getAttribute('data-dsh-lively-preset'),
        tokenBgBase: bodyStyle ? bodyStyle.getPropertyValue('--dsw-alias-bg-base').trim() : '',
        bodyBg: bodyStyle ? bodyStyle.backgroundColor : '',
        htmlBgImage: String(htmlStyle.backgroundImage).slice(0, 140),
        htmlBgColor: htmlStyle.backgroundColor,
        surfaces: (() => {
          const pick = (selector) => {
            const el = document.querySelector(selector)
            return el === null ? null : window.getComputedStyle(el).backgroundColor
          }
          return {
            frame: pick("[class$='_frame']"),
            center: pick("[class$='_centerCol']"),
            sidebar: pick("[class$='_sidebarCol']"),
          }
        })(),
        layer: runtime.layer
          ? {
              connected: runtime.layer.isConnected,
              w: Math.round(runtime.layer.getBoundingClientRect().width),
              h: Math.round(runtime.layer.getBoundingClientRect().height),
            }
          : null,
        video: runtime.video ? { paused: runtime.video.paused, w: runtime.video.videoWidth, h: runtime.video.videoHeight } : null,
        samples: {
          conversation: sample(0.62, 0.55),
          conversationLow: sample(0.72, 0.82),
          sidebar: sample(0.12, 0.45),
        },
        // The conversation tabs are the most stable anchor in the chat column;
        // their ancestor chain names the element that actually paints the column.
        conversationColumn: (() => {
          try {
            const anchor = document.querySelector('[class$="_tabs"]')
            const chain = []
            for (let node = anchor; node !== null && chain.length < 14; node = node.parentElement) {
              chain.push(describe(node))
            }
            return chain
          } catch (error) {
            return [`chain failed: ${error instanceof Error ? error.message : String(error)}`]
          }
        })(),
      }
    }

    function reportDiagnostics() {
      try {
        lastDiag = collectDiagnostics()
        fetch(STATE_ROUTE, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...state, diag: lastDiag }),
        }).catch(() => {})
      } catch {
        // diagnostics must never break the wallpaper
      }
    }

    /* ------------------------------ media upload ----------------------------- */

    async function uploadMedia(file) {
      if (!file) throw new Error('no file')
      if (file.size > MAX_MEDIA_BYTES) throw new Error(runtime.t('tooLarge'))
      const response = await fetch(MEDIA_ROUTE, {
        method: 'POST',
        headers: {
          'content-type': file.type || 'application/octet-stream',
          'x-dsh-lively-name': encodeURIComponent(file.name || ''),
        },
        body: file,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.error || `HTTP ${response.status}`)
      }
      return {
        url: payload.url,
        kind: typeof payload.type === 'string' && payload.type.startsWith('video/') ? 'video' : 'image',
        id: payload.id,
      }
    }

    /**
     * A URL is a wallpaper only if the browser can decode it as an image or a
     * video. Pasting an ordinary web page used to switch the wallpaper to that
     * URL silently, leaving a blank canvas — probe first and keep the old
     * wallpaper when the load fails.
     */
    async function probeMedia(url, kind) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 8000)
        const done = (ok) => {
          clearTimeout(timer)
          if (ok) resolve()
          else reject(new Error('load failed'))
        }
        if (kind === 'video') {
          const video = document.createElement('video')
          video.muted = true
          video.onloadedmetadata = () => done(true)
          video.onerror = () => done(false)
          video.src = url
          return
        }
        const image = new Image()
        image.onload = () => done(image.naturalWidth > 0)
        image.onerror = () => done(false)
        image.src = url
      })
    }

    /* --------------------------------- widgets ------------------------------- */

    const ui = {
      section: {
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        paddingBottom: '8px',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: '14px',
        lineHeight: '22px',
      },
      heading: { fontSize: '18px', lineHeight: '26px', fontWeight: 500 },
      sub: {
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
        lineHeight: '18px',
        marginTop: '2px',
      },
      group: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        paddingTop: '14px',
        borderTop: '1px solid var(--dsw-alias-border-l2)',
      },
      groupTitle: { fontSize: '14px', lineHeight: '20px', fontWeight: 500 },
      rowTitle: { fontSize: '14px', lineHeight: '20px', fontWeight: 500 },
      grid: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
      card: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        width: '104px',
        padding: '3px',
        borderRadius: '10px',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: 'transparent',
        background: 'transparent',
        cursor: 'pointer',
        font: 'inherit',
        boxSizing: 'border-box',
        color: 'inherit',
      },
      cardSelected: {
        borderColor: 'var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-interactive-bg-hover)',
      },
      swatch: { width: '100%', height: '56px', borderRadius: '8px' },
      cardLabel: {
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
        lineHeight: '16px',
        whiteSpace: 'nowrap',
      },
      cardLabelSelected: { color: 'var(--dsw-alias-label-primary)' },
      row: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      },
      rowText: { display: 'flex', flexDirection: 'column', gap: '2px' },
      hint: { color: 'var(--dsw-alias-label-secondary)', fontSize: '12px', lineHeight: '18px' },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '8px',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: '13px',
        lineHeight: '20px',
        padding: '6px 10px',
      },
      sliderRow: {
        display: 'grid',
        gridTemplateColumns: '120px 1fr 52px',
        alignItems: 'center',
        gap: '10px',
      },
      slider: { width: '100%', accentColor: 'var(--dsw-alias-brand-primary)' },
      value: {
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      },
      switch: (checked) => ({
        width: '40px',
        height: '22px',
        borderRadius: '999px',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: checked ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-layer-2)',
        position: 'relative',
        cursor: 'pointer',
        flex: '0 0 auto',
        padding: 0,
      }),
      switchKnob: (checked) => ({
        position: 'absolute',
        top: '2px',
        left: checked ? '20px' : '2px',
        width: '16px',
        height: '16px',
        borderRadius: '999px',
        background: checked ? 'var(--dsw-alias-brand-primary-foreground, #fff)' : 'var(--dsw-alias-label-secondary)',
        transition: 'left 120ms ease',
      }),
      button: {
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '8px',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: '12px',
        lineHeight: '18px',
        padding: '4px 10px',
      },
      buttonPrimary: {
        background: 'var(--dsw-alias-brand-primary)',
        border: '1px solid transparent',
        borderRadius: '8px',
        color: 'var(--dsw-alias-brand-primary-foreground, #fff)',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: '12px',
        lineHeight: '18px',
        padding: '4px 12px',
      },
      error: { color: 'var(--dsw-alias-state-error-primary)', fontSize: '12px', lineHeight: '18px' },
      mediaBox: {
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '10px',
        padding: '8px',
      },
      mediaThumb: {
        width: '96px',
        height: '54px',
        borderRadius: '6px',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: 'var(--dsw-alias-bg-layer-1)',
        flex: '0 0 auto',
      },
    }

    function useLivelyState() {
      const [snapshot, setSnapshot] = React.useState(getState())
      React.useEffect(() => subscribe(setSnapshot), [])
      return snapshot
    }

    /** Re-render when the interface language changes (labels are live). */
    function useLocaleTick() {
      const [, setTick] = React.useState(0)
      React.useEffect(() => {
        const ctx = runtime.ctx
        if (!ctx || !ctx.locale || typeof ctx.locale.subscribe !== 'function') return undefined
        return ctx.locale.subscribe(() => setTick((value) => value + 1))
      }, [])
    }

    function Switch({ checked, onChange, label }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': checked,
          'aria-label': label,
          onClick: () => onChange(!checked),
          style: ui.switch(checked),
        },
        h('span', { style: ui.switchKnob(checked), 'aria-hidden': 'true' }),
      )
    }

    function Slider({ label, hint, value, min, max, step, suffix, onChange }) {
      const display = `${Math.round(value * 100) / 100}${suffix || ''}`
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        h(
          'div',
          { style: ui.sliderRow },
          h('span', { style: { fontSize: '13px' } }, label),
          h('input', {
            type: 'range',
            min,
            max,
            step,
            value,
            'aria-label': label,
            style: ui.slider,
            onChange: (event) => onChange(Number(event.currentTarget.value)),
          }),
          h('span', { style: ui.value }, display),
        ),
        hint ? h('div', { style: ui.hint }, hint) : null,
      )
    }

    function PresetCard({ preset, selected, onSelect, t }) {
      return h(
        'button',
        {
          type: 'button',
          onClick: (event) => {
            onSelect()
            event.currentTarget.blur()
          },
          'aria-pressed': selected,
          style: { ...ui.card, ...(selected ? ui.cardSelected : {}) },
        },
        h('span', { style: { ...ui.swatch, background: preset.swatch } }),
        h(
          'span',
          { style: { ...ui.cardLabel, ...(selected ? ui.cardLabelSelected : {}) } },
          t(`preset.${preset.id}`),
        ),
      )
    }

    function MediaSection({ snapshot, t }) {
      const [url, setUrl] = React.useState(snapshot.mediaUrl)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [library, setLibrary] = React.useState([])
      const fileRef = React.useRef(null)

      const refreshLibrary = () => {
        fetch(LIBRARY_ROUTE)
          .then((response) => (response.ok ? response.json() : null))
          .then((payload) => {
            if (payload !== null && Array.isArray(payload.items)) setLibrary(payload.items)
          })
          .catch(() => {
            // route absent on an older host — no library list
          })
      }

      React.useEffect(() => {
        setUrl(snapshot.mediaUrl)
      }, [snapshot.mediaUrl])

      React.useEffect(() => {
        refreshLibrary()
      }, [])

      const onFile = async (event) => {
        const file = event.currentTarget.files && event.currentTarget.files[0]
        if (!file) return
        setError('')
        setBusy(true)
        try {
          const uploaded = await uploadMedia(file)
          update({
            mode: 'media',
            mediaUrl: uploaded.url,
            mediaKind: uploaded.kind,
            enabled: true,
          })
          refreshLibrary()
        } catch (cause) {
          setError(`${t('uploadFailed')}: ${cause instanceof Error ? cause.message : String(cause)}`)
        } finally {
          setBusy(false)
          event.currentTarget.value = ''
        }
      }

      const applyUrl = () => {
        const trimmed = url.trim()
        if (trimmed === '') return
        const kind = /\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(trimmed) ? 'video' : 'image'
        setError('')
        probeMedia(trimmed, kind)
          .then(() => {
            update({ mode: 'media', mediaUrl: trimmed, mediaKind: kind, enabled: true })
          })
          .catch(() => {
            setError(t('mediaUnreachable'))
          })
      }

      const removeMedia = () => {
        update({ mode: 'preset', mediaUrl: '', mediaKind: 'image' })
      }

      const useLibraryItem = (item) => {
        update({
          mode: 'media',
          mediaUrl: `${MEDIA_ROUTE}?id=${item.id}`,
          mediaKind: String(item.type).startsWith('video/') ? 'video' : 'image',
          enabled: true,
        })
      }

      return h(
        'div',
        { style: ui.group },
        h('div', { style: ui.rowTitle }, t('media')),
        h('div', { style: ui.hint }, t('mediaHint')),
        h(
          'div',
          { style: { display: 'flex', gap: '8px' } },
          h('input', {
            type: 'text',
            value: url,
            placeholder: t('mediaUrlPlaceholder'),
            'aria-label': t('mediaUrl'),
            style: ui.input,
            onChange: (event) => setUrl(event.currentTarget.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') applyUrl()
            },
          }),
          h('button', { type: 'button', style: ui.button, onClick: applyUrl }, t('applyUrl')),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          h('input', {
            ref: fileRef,
            type: 'file',
            accept: 'image/*,video/*',
            style: { display: 'none' },
            onChange: onFile,
          }),
          h(
            'button',
            { type: 'button', style: ui.buttonPrimary, disabled: busy, onClick: () => fileRef.current?.click() },
            busy ? t('uploading') : t('chooseFile'),
          ),
          snapshot.mediaUrl
            ? h('button', { type: 'button', style: ui.button, onClick: removeMedia }, t('removeMedia'))
            : null,
        ),
        error ? h('div', { style: ui.error }, error) : null,
        snapshot.mediaUrl
          ? h(
              'div',
              { style: ui.mediaBox },
              h('div', {
                style: {
                  ...ui.mediaThumb,
                  backgroundColor: 'var(--dsw-alias-bg-layer-1)',
                  backgroundImage: snapshot.mediaKind === 'image' ? `url("${snapshot.mediaUrl}")` : undefined,
                },
              }),
              h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 } },
                h('div', { style: { fontSize: '12px' } }, t('currentMedia')),
                h(
                  'div',
                  {
                    style: {
                      ...ui.hint,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '420px',
                      direction: 'rtl',
                      textAlign: 'left',
                    },
                  },
                  snapshot.mediaUrl,
                ),
              ),
            )
          : null,
        library.length > 0
          ? h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
              h('div', { style: ui.hint }, t('library')),
              h(
                'div',
                { style: ui.grid },
                library.slice(0, 12).map((item) => {
                  const video = String(item.type).startsWith('video/')
                  const size = `${Math.round(Number(item.size || 0) / 1024)} KB`
                  return h(
                    'button',
                    {
                      key: item.id,
                      type: 'button',
                      title: `${item.type} · ${size}`,
                      onClick: () => useLibraryItem(item),
                      style: { ...ui.card, width: '96px' },
                    },
                    h(
                      'span',
                      {
                        style: {
                          ...ui.swatch,
                          height: '46px',
                          backgroundColor: 'var(--dsw-alias-bg-layer-1)',
                          backgroundImage: video ? undefined : `url("${MEDIA_ROUTE}?id=${item.id}")`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: 'var(--dsw-alias-label-secondary)',
                        },
                      },
                      video ? 'MP4' : null,
                    ),
                    h('span', { style: ui.cardLabel }, size),
                  )
                }),
              ),
            )
          : null,
      )
    }

    function PlaylistSection({ snapshot, t, patch }) {
      const rotate = snapshot.rotate
      const togglePreset = (id) => {
        const ids = rotate.ids.includes(id) ? rotate.ids.filter((entry) => entry !== id) : [...rotate.ids, id]
        patch({ rotate: { ...rotate, ids } })
      }
      return h(
        'div',
        { style: ui.group },
        h('div', { style: ui.groupTitle }, t('rotate')),
        h('div', { style: ui.hint }, t('rotateHint')),
        h(
          'div',
          { style: ui.row },
          h('span', { style: { fontSize: '14px' } }, t('rotateEnable')),
          h(Switch, {
            checked: rotate.enabled,
            label: t('rotateEnable'),
            onChange: (checked) => patch({ rotate: { ...rotate, enabled: checked } }),
          }),
        ),
        rotate.enabled
          ? h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
              h('div', { style: ui.hint }, t('rotatePick')),
              h(
                'div',
                { style: ui.grid },
                PRESETS.map((preset) => {
                  const picked = rotate.ids.includes(preset.id)
                  return h(
                    'button',
                    {
                      key: preset.id,
                      type: 'button',
                      'aria-pressed': picked,
                      onClick: () => togglePreset(preset.id),
                      style: { ...ui.card, width: '88px', ...(picked ? ui.cardSelected : {}) },
                    },
                    h('span', { style: { ...ui.swatch, height: '40px', background: preset.swatch } }),
                    h(
                      'span',
                      { style: { ...ui.cardLabel, ...(picked ? ui.cardLabelSelected : {}) } },
                      t(`preset.${preset.id}`),
                    ),
                  )
                }),
              ),
              h(Slider, {
                label: t('rotateInterval'),
                value: rotate.intervalMin,
                min: 1,
                max: 120,
                step: 1,
                suffix: t('minute'),
                onChange: (value) => patch({ rotate: { ...rotate, intervalMin: value } }),
              }),
              h(
                'div',
                { style: ui.row },
                h('span', { style: { fontSize: '14px' } }, t('rotateShuffle')),
                h(Switch, {
                  checked: rotate.shuffle,
                  label: t('rotateShuffle'),
                  onChange: (checked) => patch({ rotate: { ...rotate, shuffle: checked } }),
                }),
              ),
              rotate.ids.length < 2 ? h('div', { style: ui.hint }, t('rotateNeedsTwo')) : null,
            )
          : null,
      )
    }

    function WallpaperPage() {
      const snapshot = useLivelyState()
      useLocaleTick()
      const t = runtime.t
      const patch = (value) => update(value)

      return h(
        'div',
        { style: ui.section },
        h(
          'div',
          null,
          h('div', { style: ui.heading }, t('title')),
          h('div', { style: ui.sub }, t('subtitle')),
        ),
        h(
          'div',
          { style: ui.row },
          h(
            'div',
            { style: ui.rowText },
            h('span', { style: { fontSize: '14px' } }, t('enable')),
            h('span', { style: ui.hint }, t('enableHint')),
          ),
          h(Switch, {
            checked: snapshot.enabled,
            label: t('enable'),
            onChange: (checked) => patch({ enabled: checked }),
          }),
        ),
        h(
          'div',
          { style: ui.group },
          h('div', { style: ui.groupTitle }, t('presets')),
          h('div', { style: ui.hint }, t('presetsHint')),
          h(
            'div',
            { style: ui.grid },
            PRESETS.map((preset) =>
              h(PresetCard, {
                key: preset.id,
                preset,
                selected: snapshot.mode === 'preset' && snapshot.preset === preset.id,
                t,
                onSelect: () => patch({ mode: 'preset', preset: preset.id, enabled: true }),
              }),
            ),
          ),
        ),
        h(PlaylistSection, { snapshot, t, patch }),
        h(MediaSection, { snapshot, t }),
        h(
          'div',
          { style: ui.group },
          h(Slider, {
            label: t('strength'),
            hint: t('strengthHint'),
            value: snapshot.strength,
            min: 0,
            max: 100,
            step: 1,
            suffix: '%',
            onChange: (value) => patch({ strength: value }),
          }),
          h(Slider, {
            label: t('dim'),
            hint: t('dimHint'),
            value: snapshot.dim,
            min: 0,
            max: 90,
            step: 1,
            suffix: '%',
            onChange: (value) => patch({ dim: value }),
          }),
          h(Slider, {
            label: t('blur'),
            hint: t('blurHint'),
            value: snapshot.blur,
            min: 0,
            max: 24,
            step: 1,
            suffix: 'px',
            onChange: (value) => patch({ blur: value }),
          }),
          h(Slider, {
            label: t('speed'),
            value: snapshot.speed,
            min: 0.25,
            max: 3,
            step: 0.05,
            suffix: '×',
            onChange: (value) => patch({ speed: value }),
          }),
          h(
            'div',
            { style: ui.row },
            h(
              'div',
              { style: ui.rowText },
              h('span', { style: { fontSize: '14px' } }, t('motion')),
              h('span', { style: ui.hint }, t('motionHint')),
            ),
            h(Switch, {
              checked: snapshot.motion !== false,
              label: t('motion'),
              onChange: (checked) => patch({ motion: checked }),
            }),
          ),
        ),
        h(
          'div',
          { style: ui.row },
          h(
            'div',
            { style: ui.rowText },
            h('span', { style: { fontSize: '14px' } }, t('pause')),
            h('span', { style: ui.hint }, t('pauseHint')),
          ),
          h(Switch, {
            checked: snapshot.pauseOnHidden,
            label: t('pause'),
            onChange: (checked) => patch({ pauseOnHidden: checked }),
          }),
        ),
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'flex-end' } },
          h(
            'button',
            {
              type: 'button',
              style: ui.button,
              onClick: () => patch({ ...DEFAULTS, enabled: true }),
            },
            t('reset'),
          ),
        ),
      )
    }

    /* --------------------------------- plugin -------------------------------- */

    const inject = ['slots', 'locale', 'theme']

    function apply(ctx) {
      runtime.ctx = ctx

      try {
        runtime.t = ctx.locale.bind ? ctx.locale.bind(NS) : (key) => key
      } catch {
        runtime.t = (key) => key
      }

      // 1. Restore the saved settings, then paint.
      const local = readLocal()
      if (local !== null) state = local

      const style = document.createElement('style')
      style.id = 'dsh-lively-style'
      document.head.appendChild(style)
      runtime.style = style
      applyCss()
      syncLayer()
      syncPlayback()
      scheduleRotation()

      // 2. Durable hydrate from the Host route (Desktop loses localStorage
      //    between launches because the loopback port changes).
      fetch(STATE_ROUTE)
        .then((response) => (response.ok ? response.json() : null))
        .then((remote) => {
          if (local !== null || remote === null || typeof remote !== 'object') return
          if (Object.keys(remote).length === 0) return
          state = normalize(remote)
          writeLocal()
          applyCss()
          syncLayer()
          syncPlayback()
          emit()
          scheduleRotation()
        })
        .catch(() => {
          // route absent (older host) — localStorage-only mode
        })
        .finally(() => {
          // Diagnostics must not run before the hydrate settles: they PUT the
          // whole state back, and a boot-time default would overwrite the
          // user's saved choice on the Host.
          scheduleDiagnostics()
        })

      // 3. Theme switches need no JS for the wash (CSS keys on
      //    body[data-ds-dark-theme]), but the bright/dark wallpaper variants
      //    key on our own tone attribute, so follow the change.
      ctx.effect(
        () =>
          ctx.on('theme/change', () => {
            syncLayerVars()
            reportDiagnostics()
          }),
        'dsh-lively: tone follow',
      )

      // 4. Hidden-window pause.
      ctx.effect(() => {
        const onVisibility = () => syncPlayback()
        document.addEventListener('visibilitychange', onVisibility)
        return () => document.removeEventListener('visibilitychange', onVisibility)
      }, 'dsh-lively: visibility pause')

      // 5. Settings page under Settings → Wallpaper.
      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        'dsh-lively: dictionaries',
      )

      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'wallpaper',
            order: 50,
            label: () => runtime.t('nav'),
          },
          WallpaperPage,
        ),
      )

      // 6. Teardown: remove the layer, the media element, the stylesheet and
      //    the root variables, leaving the page exactly as we found it.
      ctx.effect(
        () => () => {
          if (runtime.flushTimer !== null) clearTimeout(runtime.flushTimer)
          stopRotation()
          for (const timer of diagTimers) clearTimeout(timer)
          diagTimers = []
          teardownMedia()
          document.documentElement.removeAttribute('data-dsh-lively-preset')
          document.documentElement.removeAttribute('data-dsh-lively-tone')
          document.documentElement.removeAttribute('data-dsh-lively-motion')
          document.documentElement.style.removeProperty('--dsh-lively-image')
          style.remove()
          runtime.style = null
          for (const name of [
            '--dsh-lively-speed',
            '--dsh-lively-dim',
            '--dsh-lively-blur',
            '--dsh-lively-glass',
            '--dsh-lively-veil',
            '--dsh-lively-veil-strong',
          ]) {
            document.documentElement.style.removeProperty(name)
          }
          document.documentElement.removeAttribute('data-dsh-lively-paused')
        },
        'dsh-lively: teardown',
      )
    }

    return {
      inject,
      apply,
      // exported for tests and for a future host-side library listing
      PRESETS,
      DEFAULTS,
    }
  },
})
