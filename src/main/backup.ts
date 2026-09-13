import { app, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { createGzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { createReadStream, createWriteStream } from 'fs'
import http from 'http'
import net from 'net'
import { google } from 'googleapis'

// ── Simple lazy JSON config (avoids electron-store ESM issues) ─────────────
// All functions here are called only after app.whenReady(), so app.getPath()
// is always available when these run.

let _cache: Record<string, unknown> | null = null

function cfgPath(): string {
  return path.join(app.getPath('userData'), 'backup-config.json')
}

function cache(): Record<string, unknown> {
  if (_cache !== null) return _cache
  try { _cache = JSON.parse(fs.readFileSync(cfgPath(), 'utf-8')) }
  catch { _cache = {} }
  return _cache
}

function cfg(key: string): unknown {
  return cache()[key]
}

function setCfg(key: string, value: unknown): void {
  cache()[key] = value
  fs.writeFileSync(cfgPath(), JSON.stringify(cache(), null, 2), 'utf-8')
}

function delCfg(key: string): void {
  delete cache()[key]
  fs.writeFileSync(cfgPath(), JSON.stringify(cache(), null, 2), 'utf-8')
}

// ── Constants ──────────────────────────────────────────────────────────────

const FOLDER_NAME = 'Badachuli Rice Mill Backups'
const MAX_BACKUPS = 30
const DEFAULT_HOUR = 19
const REDIRECT_PORT = 48123
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`

let schedulerTimer: ReturnType<typeof setInterval> | null = null

// ── Public status ──────────────────────────────────────────────────────────

export function getBackupStatus() {
  return {
    connected: Boolean(cfg('refresh_token')),
    clientConfigured: Boolean(cfg('client_id') && cfg('client_secret')),
    lastBackupAt: (cfg('last_backup_at') as string) || null,
    lastBackupFile: (cfg('last_backup_file') as string) || null,
    scheduleHour: ((cfg('schedule_hour') as number) ?? DEFAULT_HOUR) as number,
  }
}

export function saveClientCredentials(clientId: string, clientSecret: string) {
  setCfg('client_id', clientId.trim())
  setCfg('client_secret', clientSecret.trim())
  delCfg('refresh_token')
  delCfg('tokens')
  delCfg('folder_id')
  _cache = null // force re-read so deletes are reflected
  cache()
}

export function setScheduleHour(hour: number) {
  setCfg('schedule_hour', hour)
}

export function disconnectDrive() {
  delCfg('refresh_token')
  delCfg('tokens')
  delCfg('folder_id')
}

// ── OAuth2 ─────────────────────────────────────────────────────────────────

function makeOAuth2() {
  const clientId = cfg('client_id') as string | undefined
  const clientSecret = cfg('client_secret') as string | undefined
  if (!clientId || !clientSecret) return null

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)
  const tokens = cfg('tokens')
  if (tokens) oauth2.setCredentials(tokens as object)

  oauth2.on('tokens', (refreshed) => {
    const existing = (cfg('tokens') as object) ?? {}
    setCfg('tokens', { ...existing, ...refreshed })
  })

  return oauth2
}

export async function startOAuthFlow(): Promise<{ ok: boolean; error?: string }> {
  const clientId = cfg('client_id') as string | undefined
  const clientSecret = cfg('client_secret') as string | undefined
  if (!clientId || !clientSecret) {
    return { ok: false, error: 'Client ID र Client Secret पहिले सेट गर्नुस्।' }
  }

  return new Promise((resolve) => {
    const server = http.createServer()

    server.on('error', (e) => {
      resolve({ ok: false, error: `Auth server error: ${e.message}` })
    })

    const timeout = setTimeout(() => {
      server.close()
      resolve({ ok: false, error: 'Authorization timed out (5 min)' })
    }, 5 * 60 * 1000)

    server.listen(REDIRECT_PORT, 'localhost', () => {
      const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)
      const authUrl = oauth2.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file'],
        prompt: 'consent',
      })
      shell.openExternal(authUrl)
    })

    server.on('request', async (req, res) => {
      if (!req.url?.startsWith('/callback')) return

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<html><body style="font-family:sans-serif;padding:2rem"><h2>✓ Google Drive connected!</h2><p>You can close this tab.</p></body></html>')
      clearTimeout(timeout)
      server.close()

      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error || !code) {
        resolve({ ok: false, error: error ?? 'No authorization code received' })
        return
      }

      try {
        const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)
        const { tokens } = await oauth2.getToken(code)
        setCfg('tokens', tokens)
        if (tokens.refresh_token) setCfg('refresh_token', tokens.refresh_token)
        resolve({ ok: true })
      } catch (e) {
        resolve({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    })
  })
}

// ── Drive helpers ──────────────────────────────────────────────────────────

async function ensureFolder(drive: ReturnType<typeof google.drive>): Promise<string> {
  const cached = cfg('folder_id') as string | undefined
  if (cached) {
    try {
      await drive.files.get({ fileId: cached, fields: 'id' })
      return cached
    } catch {
      // Folder was deleted — fall through to create a new one
    }
  }

  const res = await drive.files.create({
    requestBody: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  })
  const id = res.data.id as string
  setCfg('folder_id', id)
  return id
}

async function pruneOldBackups(drive: ReturnType<typeof google.drive>, folderId: string) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name)',
    orderBy: 'createdTime asc',
    pageSize: 100,
  })
  const files = res.data.files ?? []
  if (files.length <= MAX_BACKUPS) return
  const toDelete = files.slice(0, files.length - MAX_BACKUPS)
  await Promise.all(toDelete.map((f) => drive.files.delete({ fileId: f.id! }).catch(() => {})))
}

// ── Online check ───────────────────────────────────────────────────────────

function isOnline(): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createConnection({ host: '8.8.8.8', port: 53 })
    s.setTimeout(3000)
    s.on('connect', () => { s.destroy(); resolve(true) })
    s.on('error', () => resolve(false))
    s.on('timeout', () => { s.destroy(); resolve(false) })
  })
}

// ── Core backup ────────────────────────────────────────────────────────────

export async function backupNow(): Promise<{ ok: boolean; error?: string; fileName?: string }> {
  const oauth2 = makeOAuth2()
  if (!oauth2) return { ok: false, error: 'Google Drive configured छैन।' }
  if (!cfg('refresh_token')) return { ok: false, error: 'Google Drive connected छैन। पहिले connect गर्नुस्।' }

  if (!(await isOnline())) return { ok: false, error: 'Internet connection छैन।' }

  const dbPath = app.isPackaged
    ? path.join(app.getPath('userData'), 'badachuli.db')
    : path.join(process.cwd(), 'dev.db')

  if (!fs.existsSync(dbPath)) return { ok: false, error: 'Database file फेला परेन।' }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  const fileName = `badachuli_${ts}.db.gz`
  const tmpPath = path.join(app.getPath('temp'), fileName)

  try {
    await pipeline(createReadStream(dbPath), createGzip({ level: 9 }), createWriteStream(tmpPath))

    const drive = google.drive({ version: 'v3', auth: oauth2 })
    const folderId = await ensureFolder(drive)

    await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: 'application/gzip', body: createReadStream(tmpPath) },
      fields: 'id',
    })

    await pruneOldBackups(drive, folderId).catch(() => {})

    setCfg('last_backup_at', new Date().toISOString())
    setCfg('last_backup_file', fileName)

    console.log('[backup] uploaded:', fileName)
    return { ok: true, fileName }
  } finally {
    fs.unlink(tmpPath, () => {})
  }
}

// ── Evening scheduler ──────────────────────────────────────────────────────

async function maybeScheduledBackup() {
  if (!cfg('refresh_token')) return

  const hour = (cfg('schedule_hour') as number) ?? DEFAULT_HOUR
  const now = new Date()
  if (now.getHours() < hour) return

  const todayKey = now.toISOString().split('T')[0]
  const lastAt = cfg('last_backup_at') as string | undefined
  if (lastAt?.startsWith(todayKey)) return

  await backupNow().catch((e) => console.error('[backup] scheduled run failed:', e))
}

export function startEveningScheduler() {
  if (schedulerTimer) return
  schedulerTimer = setInterval(maybeScheduledBackup, 30 * 60 * 1000)
  setTimeout(maybeScheduledBackup, 10_000)
}
