// Deterministic frame capture via Chrome DevTools Protocol (no npm deps).
//   node capture.mjs <page.html> <outDir> --fps 30 --dur 22.5 [--w 1920] [--h 1080]
//   node capture.mjs <page.html> <outDir> --times 0.5,3.2,9.0 [--prefix still]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2)
const pagePath = resolve(args[0])
const outDir = resolve(args[1])
const flag = (n, d) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1] }
const FPS = Number(flag('fps', 30))
const DUR = Number(flag('dur', 0))
const W = Number(flag('w', 1920))
const H = Number(flag('h', 1080))
const PREFIX = flag('prefix', 'f')
const TIMES = flag('times', null)

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333 + (Number(process.env.CAP_PORT_OFFSET) || Math.floor(Math.random() * 500))
const profile = `${tmpdir()}/brag-chrome-${PORT}`
rmSync(profile, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`,
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--allow-file-access-from-files',
  '--font-render-hinting=medium',
  '--mute-audio',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })
chrome.stderr.on('data', () => {})

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function pageWsUrl() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await r.json()
      const page = targets.find(t => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(100)
  }
  throw new Error('chrome did not come up')
}

const wsUrl = await pageWsUrl()
const ws = new WebSocket(wsUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

let msgId = 0
const pending = new Map()
const events = []
ws.onmessage = ev => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id)
    m.error ? rej(new Error(m.error.message)) : res(m.result)
  } else if (m.method) events.push(m)
}
function cdp(method, params = {}) {
  const id = ++msgId
  return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })) })
}

await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })

const loaded = new Promise(res => {
  const iv = setInterval(() => {
    if (events.some(e => e.method === 'Page.loadEventFired')) { clearInterval(iv); res() }
  }, 30)
})
await cdp('Page.navigate', { url: 'file://' + pagePath })
await loaded
// wait for fonts + images
for (let i = 0; i < 100; i++) {
  const r = await cdp('Runtime.evaluate', {
    expression: `(document.fonts.status==='loaded') && Array.from(document.images).every(i=>i.complete) && !!window.setT`,
    returnByValue: true,
  })
  if (r.result.value === true) break
  await sleep(100)
}
await cdp('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true })
await sleep(400)

const PROBE = flag('probe', null)
if (PROBE) {
  const r = await cdp('Runtime.evaluate', { expression: PROBE, returnByValue: true })
  console.log(JSON.stringify(r.result.value, null, 2))
  ws.close(); chrome.kill('SIGKILL'); try { rmSync(profile, { recursive: true, force: true }) } catch {}; process.exit(0)
}

const times = TIMES
  ? TIMES.split(',').map(Number)
  : Array.from({ length: Math.round(DUR * FPS) }, (_, i) => i / FPS)

const pad = n => String(n).padStart(5, '0')
let n = 0
for (const t of times) {
  await cdp('Runtime.evaluate', { expression: `window.setT(${t})`, returnByValue: true })
  const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true })
  const name = TIMES ? `${PREFIX}_${t.toFixed(2)}.png` : `${PREFIX}${pad(n + 1)}.png`
  writeFileSync(`${outDir}/${name}`, Buffer.from(shot.data, 'base64'))
  n++
  if (!TIMES && n % 60 === 0) process.stderr.write(`  ${n}/${times.length}\n`)
}
process.stderr.write(`captured ${n} frames -> ${outDir}\n`)
ws.close()
chrome.kill('SIGKILL')
try { rmSync(profile, { recursive: true, force: true }) } catch {}
process.exit(0)
