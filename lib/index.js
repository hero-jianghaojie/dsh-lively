/**
 * dsh-lively — host half.
 *
 * Three exact webServer routes (the same pattern the shipped ui-* packages
 * and dsh-catppuccin use):
 *
 *   - `/dsh-lively/state` (GET / PUT): durable wallpaper settings in a small
 *     JSON file under `$DSH_HOME` (`dsh-lively-state.json`), written
 *     atomically (temp + rename). The browser localStorage is the instant
 *     layer; this file survives DSH Desktop's random per-launch loopback
 *     port, where localStorage (scoped per origin, port included) always
 *     starts empty.
 *
 *   - `/dsh-lively/media` (POST / GET / DELETE): the wallpaper library.
 *     POST stores the raw request body as one media file under
 *     `$DSH_HOME/dsh-lively/media/` and answers with its URL; GET streams a
 *     stored file back with its recorded content type; DELETE removes it.
 *     This is what lets a picked local image, GIF or video survive a reload
 *     and a restart: the browser never re-reads the disk, it asks this route.
 *
 * `webServer` is a hard inject dependency, so this half only activates where
 * the service is live (headless profiles have none and stay inert).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const name = 'dsh-lively'
export const inject = ['webServer']

const STATE_PATH = '/dsh-lively/state'
const MEDIA_PATH = '/dsh-lively/media'
const STATE_FILENAME = 'dsh-lively-state.json'
const MEDIA_DIR_NAME = 'dsh-lively-media'
const MAX_MEDIA_BYTES = 96 * 1024 * 1024
const MEDIA_ID = /^[a-z0-9]{6,64}$/

/** Image, GIF, WebP and video types the wallpaper layer can actually paint. */
const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['video/ogg', 'ogv'],
])

/** Suffix fallback for uploads whose Content-Type the browser left generic. */
const TYPE_BY_SUFFIX = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['gif', 'image/gif'],
  ['webp', 'image/webp'],
  ['avif', 'image/avif'],
  ['mp4', 'video/mp4'],
  ['webm', 'video/webm'],
  ['ogv', 'video/ogg'],
])

/* ------------------------------ durable state ------------------------------ */

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

function stateFilePath() {
  return join(dshHome(), STATE_FILENAME)
}

function mediaDir() {
  return join(dshHome(), MEDIA_DIR_NAME)
}

/** Read the durable state; absent or unparseable means none yet. */
function readDurableState() {
  try {
    const parsed = JSON.parse(readFileSync(stateFilePath(), 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed
  } catch {
    return null
  }
}

/** Write atomically: temp file + rename over the target. */
function writeDurableState(state) {
  const path = stateFilePath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  renameSync(tmp, path)
}

/* -------------------------------- http utils ------------------------------- */

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error(`payload exceeds ${limit} bytes`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function queryOf(req) {
  const index = (req.url || '').indexOf('?')
  if (index < 0) return new URLSearchParams()
  return new URLSearchParams((req.url || '').slice(index + 1))
}

/** A short opaque id; the file name and the id are the same value. */
function newMediaId() {
  const stamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${stamp}${random}`.toLowerCase()
}

function mediaFile(id) {
  return join(mediaDir(), id)
}

function mediaTypeFile(id) {
  return join(mediaDir(), `${id}.type`)
}

/* ------------------------------- media routes ------------------------------ */

function handleMediaPost(req, res) {
  let declaredName = ''
  try {
    declaredName = decodeURIComponent(String(req.headers['x-dsh-lively-name'] || ''))
  } catch {
    declaredName = ''
  }
  const suffix = declaredName.includes('.') ? declaredName.split('.').pop().toLowerCase() : ''
  const declaredType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
  const type = ALLOWED_TYPES.has(declaredType) ? declaredType : TYPE_BY_SUFFIX.get(suffix)
  if (type === undefined) {
    json(res, 415, { ok: false, error: `unsupported media type: ${declaredType || '(none)'}` })
    return
  }
  readBody(req, MAX_MEDIA_BYTES)
    .then((buffer) => {
      if (buffer.length === 0) throw new Error('empty body')
      const id = newMediaId()
      mkdirSync(mediaDir(), { recursive: true })
      const target = mediaFile(id)
      writeFileSync(target, buffer, { mode: 0o600 })
      writeFileSync(mediaTypeFile(id), type, { mode: 0o600 })
      json(res, 200, {
        ok: true,
        id,
        type,
        size: buffer.length,
        url: `${MEDIA_PATH}?id=${id}`,
      })
    })
    .catch((error) => {
      json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
    })
}

function handleMediaGet(req, res) {
  const id = String(queryOf(req).get('id') || '')
  if (!MEDIA_ID.test(id)) {
    json(res, 400, { ok: false, error: 'bad media id' })
    return
  }
  let body
  try {
    body = readFileSync(mediaFile(id))
  } catch {
    json(res, 404, { ok: false, error: 'media not found' })
    return
  }
  let type = 'application/octet-stream'
  try {
    type = readFileSync(mediaTypeFile(id), 'utf8').trim()
  } catch {
    // a missing sidecar only costs the content type, not the bytes
  }
  res.writeHead(200, {
    'content-type': type,
    'content-length': body.length,
    'cache-control': 'public, max-age=31536000, immutable',
  })
  res.end(body)
}

function handleMediaDelete(req, res) {
  const id = String(queryOf(req).get('id') || '')
  if (!MEDIA_ID.test(id)) {
    json(res, 400, { ok: false, error: 'bad media id' })
    return
  }
  for (const path of [mediaFile(id), mediaTypeFile(id)]) {
    try {
      rmSync(path, { force: true })
    } catch {
      // a file that is already gone is the desired end state
    }
  }
  json(res, 200, { ok: true })
}

/* ---------------------------------- entry ---------------------------------- */

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) return

  const disposers = [
    webServer.register({
      kind: 'exact',
      path: STATE_PATH,
      handler: async (req, res) => {
        if (req.method === 'GET') {
          json(res, 200, readDurableState() ?? {})
          return
        }
        if (req.method === 'PUT') {
          try {
            const parsed = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8'))
            if (typeof parsed !== 'object' || parsed === null) throw new Error('bad body')
            writeDurableState(parsed)
            json(res, 200, { ok: true })
          } catch (error) {
            json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
          return
        }
        json(res, 405, { ok: false, error: 'method not allowed' })
      },
    }),
    webServer.register({
      kind: 'exact',
      path: MEDIA_PATH,
      handler: (req, res) => {
        if (req.method === 'POST') {
          handleMediaPost(req, res)
          return
        }
        if (req.method === 'GET') {
          handleMediaGet(req, res)
          return
        }
        if (req.method === 'DELETE') {
          handleMediaDelete(req, res)
          return
        }
        json(res, 405, { ok: false, error: 'method not allowed' })
      },
    }),
  ]

  ctx.effect(
    () => () => {
      for (const dispose of disposers) dispose()
    },
    'dsh-lively: host routes',
  )
}

/** Exported for a future `/dsh-lively/library` listing route. */
export const MEDIA_DIR = mediaDir
export const STATE_FILE = stateFilePath
export const statMedia = (id) => {
  try {
    return statSync(mediaFile(id)).size
  } catch {
    return null
  }
}
