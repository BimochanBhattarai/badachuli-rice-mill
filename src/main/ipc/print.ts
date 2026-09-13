import { ipcMain, app } from 'electron'
import { exec } from 'child_process'
import path from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs'
import net from 'net'
import type { BillWithCustomer, BillLineWithDetail, BusinessRow } from '../../shared/types/api'

// ── Types ─────────────────────────────────────────────────────────────────
interface PngImage {
  width: number
  height: number
  data: Buffer
}

// ── Nepali utilities ──────────────────────────────────────────────────────
const NE_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

function toNepaliNum(str: string | number): string {
  return String(str).replace(/[0-9]/g, d => NE_DIGITS[parseInt(d)])
}

function fmtAmtNe(n: number): string {
  const neg = n < 0
  const parts = Math.abs(n).toFixed(2).split('.')
  const whole = parseInt(parts[0]).toLocaleString('en-NP')
  return (neg ? '- ' : '') + 'रु.' + toNepaliNum(whole) + '.' + toNepaliNum(parts[1])
}

const BS_MONTHS = [
  'बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत',
]

const BS_YEAR_DATA: Record<number, number[]> = {
  2070: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2073: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2074: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2075: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2077: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2078: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2079: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2081: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 30],
  2083: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2085: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2086: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2087: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2088: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2089: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
}

const REF_AD = new Date(2013, 3, 14)
const REF_BS = { year: 2070, month: 1, day: 1 }

function adToBS(adDate: Date): { year: number; month: number; day: number } {
  // Use local date components so Nepal timezone is respected. Raw getTime()
  // comparison against REF_AD (local midnight) gives wrong day for bills
  // created before 05:45 AM NPT (those are still the previous UTC day).
  const local = new Date(adDate.getFullYear(), adDate.getMonth(), adDate.getDate())
  const diffDays = Math.floor((local.getTime() - REF_AD.getTime()) / 86400000)
  let { year, month, day } = REF_BS
  let remaining = diffDays
  while (remaining > 0) {
    const md = BS_YEAR_DATA[year]
    if (!md) break
    const dim = md[month - 1]
    if (day + remaining <= dim) { day += remaining; remaining = 0 }
    else { remaining -= dim - day + 1; day = 1; month++; if (month > 12) { month = 1; year++ } }
  }
  return { year, month, day }
}

function fmtDateBS(s: string): string {
  const ad = new Date(s)
  if (isNaN(ad.getTime())) return s
  const { year, month, day } = adToBS(ad)
  return toNepaliNum(String(day).padStart(2, '0')) + ' ' + BS_MONTHS[month - 1] + ' ' + toNepaliNum(year)
}

// ── HTML receipt generation ───────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Body is 288px CSS. With webPreferences.scaleFactor=2 the offscreen renderer
// produces 576 physical pixels — exactly the ZKP8016's 576-dot printable width.
// pngToEscPos receives a 576px-wide PNG and targets 576 dots → scale = 1.0
// (no upscaling or downscaling, perfect 1:1 mapping, no quality loss).
const RECEIPT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 13px; line-height: 1.5;
    width: 288px; color: #000; background: #fff; padding: 8mm 3mm 0;
  }
  .center { text-align: center; margin-bottom: 3px; }
  .mill-name { font-size: 17px; font-weight: 700; letter-spacing: 0.02em; }
  .detail { font-size: 12px; margin-top: 1px; }
  .divider { border: none; border-top: 1.5px dashed #333; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .row-total {
    font-weight: 700; font-size: 14px;
    border-top: 2px solid #000; margin-top: 3px; padding-top: 3px;
  }
  .row-due { font-weight: 700; }
  .line { display: flex; align-items: baseline; padding: 2px 0; }
  .line-header {
    display: flex; font-weight: 600; padding: 2px 0;
    border-bottom: 1px solid #555; margin-bottom: 2px;
  }
  .col-item { flex: 1; min-width: 0; padding-right: 4px; }
  .col-qty { width: 50px; text-align: right; flex-shrink: 0; }
  .col-rate { width: 65px; text-align: right; flex-shrink: 0; }
  .col-total { width: 72px; text-align: right; flex-shrink: 0; font-weight: 500; }
  .line-discount { font-size: 11px; color: #444; margin-top: -2px; margin-bottom: 2px; padding-left: 2px; }
  .footer { text-align: center; font-size: 12px; padding: 3px 0 5px; }
`

function buildReceiptHtml(
  bill: BillWithCustomer,
  lines: BillLineWithDetail[],
  business: BusinessRow,
): string {
  const hasDue = bill.due_amount > 0.005

  const linesHtml = lines.map(l => {
    const label = l.variant_name && l.variant_name !== l.item_name
      ? `${l.item_name} (${l.variant_name})`
      : l.item_name
    const discRow = l.line_discount > 0
      ? `<div class="line-discount">छूट: ${fmtAmtNe(l.line_discount)}</div>`
      : ''
    return `<div class="line">
        <span class="col-item">${esc(label)}</span>
        <span class="col-qty">${toNepaliNum(l.qty)}${esc(l.unit_abbreviation)}</span>
        <span class="col-rate">${fmtAmtNe(l.rate_snapshot)}</span>
        <span class="col-total">${fmtAmtNe(l.line_total)}</span>
      </div>${discRow}`
  }).join('\n')

  const discountRow = bill.discount_amount > 0
    ? `<div class="row"><span>छूट</span><span>- ${fmtAmtNe(bill.discount_amount)}</span></div>`
    : ''
  const dueRow = hasDue
    ? `<div class="row row-due"><span>बाँकी (उधारो)</span><span>${fmtAmtNe(bill.due_amount)}</span></div>`
    : ''
  const customerRow = bill.customer_name
    ? `<div class="row"><span>ग्राहक</span><span>${esc(bill.customer_name)}</span></div>`
    : ''
  const addressLine = business.address ? `<div class="detail">${esc(business.address)}</div>` : ''
  const phoneLine   = business.phone   ? `<div class="detail">फोन: ${esc(business.phone)}</div>` : ''
  const panLine     = business.pan_number ? `<div class="detail">PAN: ${esc(business.pan_number)}</div>` : ''

  return `<!DOCTYPE html>
<html lang="ne">
<head><meta charset="utf-8"><style>${RECEIPT_CSS}</style></head>
<body onload="document.fonts.ready.then(function(){requestAnimationFrame(function(){requestAnimationFrame(function(){document.body.setAttribute('data-print-ready','1')})})})">
  <div class="center">
    <div class="mill-name">${esc(business.name)}</div>
    ${addressLine}${phoneLine}${panLine}
  </div>
  <div class="divider"></div>
  <div class="row"><span>बिल नं.</span><span>${esc(bill.bill_number)}</span></div>
  <div class="row"><span>मिति</span><span>${fmtDateBS(bill.created_at)}</span></div>
  <div class="row"><span>प्रकार</span><span>${bill.bill_type === 'processing' ? 'प्रशोधन' : 'बिक्री'}</span></div>
  ${customerRow}
  <div class="divider"></div>
  <div class="line-header">
    <span class="col-item">वस्तु</span>
    <span class="col-qty">परिमाण</span>
    <span class="col-rate">दर</span>
    <span class="col-total">जम्मा</span>
  </div>
  ${linesHtml}
  <div class="divider"></div>
  <div class="row"><span>उप-जम्मा</span><span>${fmtAmtNe(bill.subtotal)}</span></div>
  ${discountRow}
  <div class="row row-total"><span>ग्राण्ड जम्मा</span><span>${fmtAmtNe(bill.grand_total)}</span></div>
  <div class="row"><span>तिरेको</span><span>${fmtAmtNe(bill.paid_amount)}</span></div>
  ${dueRow}
  <div class="divider"></div>
  <div class="footer">${hasDue ? 'धन्यवाद — माथि उल्लेखित रकम बाँकी छ' : 'धन्यवाद!'}</div>
</body>
</html>`
}

// ── TCP direct print ───────────────────────────────────────────────────────

// Send ESC @ to the printer before and after each job. Initiated before rendering
// so the printer has ~600 ms to process the reset while Chromium renders the page.
// Best-effort — failure is logged but does not abort the print job.
async function sendResetViaTcp(host: string, port: number): Promise<void> {
  try {
    await sendViaTcp(host, port, Buffer.from([0x1B, 0x40]))
  } catch (e) {
    console.warn('[print] pre-reset failed:', e instanceof Error ? e.message : String(e))
  }
}

function sendViaTcp(host: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    socket.setTimeout(8000)

    let settled = false
    function done(err?: Error) {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve()
    }

    socket.on('connect', () => {
      // Write all data, then half-close (FIN). Resolve only when the
      // socket is fully closed — this guarantees the OS has flushed
      // everything to the network before we return.
      socket.write(data, (err) => {
        if (err) { socket.destroy(); done(err); return }
        socket.end()
      })
    })
    socket.on('close', () => done())
    socket.on('timeout', () => {
      socket.destroy()
      done(new Error(`Printer at ${host}:${port} timed out`))
    })
    socket.on('error', (err) => done(err))
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────
function execPromise(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
  })
}

async function getFirstPrinter(): Promise<string | null> {
  try {
    const out = await execPromise('/usr/bin/lpstat -e')
    const first = out.trim().split('\n').filter(Boolean)[0]
    return first ?? null
  } catch {
    return null
  }
}

async function cupsRawFallback(escData: Buffer, binPath: string): Promise<void> {
  fs.writeFileSync(binPath, escData)
  const printerName = await getFirstPrinter()
  if (!printerName) {
    throw new Error(
      'कुनै प्रिन्टर फेला परेन। Settings > Printing मा IP ठेगाना थप्नुस् वा System Settings > Printers & Scanners मा प्रिन्टर थप्नुस्।'
    )
  }
  await execPromise(
    `/usr/bin/lpadmin -p "${printerName}" -o document-format=application/vnd.cups-raw`
  ).catch(() => {})
  await execPromise(`/usr/bin/cupsenable "${printerName}"`).catch(() => {})
  const sent = await execPromise(
    `/usr/bin/lp -d "${printerName}" "${binPath}"`
  ).catch(() =>
    execPromise(`/usr/bin/lpr -l -P "${printerName}" "${binPath}"`)
  )
  console.log('[print] CUPS queued:', sent.trim())
}

// Windows fallback: render the receipt HTML in a hidden window and send to
// the default Windows printer via the OS print spooler. This path is used
// when no TCP/IP printer address is configured.
async function windowsPrint(htmlPath: string): Promise<void> {
  const { BrowserWindow } = require('electron') as typeof import('electron')
  const win = new BrowserWindow({
    width: 400,
    height: 1200,
    show: false,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  try {
    await win.loadURL(pathToFileURL(htmlPath).href)
    await new Promise(r => setTimeout(r, 1200))
    await new Promise<void>((resolve, reject) => {
      win.webContents.print({ silent: true, printBackground: false }, (success, errorType) => {
        if (success) resolve()
        else reject(new Error(
          errorType === 'cancelled'
            ? 'Print cancelled'
            : `Windows print failed (${errorType ?? 'unknown'}). Configure printer IP in Settings for thermal printing.`
        ))
      })
    })
    console.log('[print] sent via Windows print spooler')
  } finally {
    win.destroy()
  }
}

// PNG buffer → ESC/POS using GS v 0 raster bit image (1:1 pixel mapping).
//
// GS v 0 maps each PNG pixel directly to one printer dot — no scaling, no
// downsampling, no stroke inflation.  This is the only command that gives
// true 1:1 quality on the ZKP8016.
//
// The ZKP8016 has a firmware bug: its GS v 0 state machine is not cleared by
// ESC @ between jobs, so the first strip of every subsequent job is consumed
// by the phantom state of the previous job's last strip (producing garbled
// output where the business name should appear).
//
// Fix: the CSS body has 8 mm of top padding, making the first strip (~50 rows)
// entirely blank (all-zero bytes).  When the phantom state eats strip 1 it
// prints nothing visible.  Strip 2 onward — which contains the business name
// and all actual content — is processed cleanly from a fresh state every time.
function pngToEscPos(pngBuffer: Buffer, targetWidth = 576): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PNG } = require('pngjs') as { PNG: { sync: { read: (b: Buffer) => PngImage } } }
  const img: PngImage = PNG.sync.read(pngBuffer)
  const { width, height, data } = img

  // Composite RGBA on white; transparent pixels → white (no ink).
  function bright(srcX: number, srcY: number): number {
    const sx = Math.min(Math.floor(srcX), width - 1)
    const sy = Math.min(Math.floor(srcY), height - 1)
    const i  = (sy * width + sx) * 4
    const a  = (data[i + 3] ?? 255) / 255
    const r  = (data[i]     ?? 255) * a + 255 * (1 - a)
    const g  = (data[i + 1] ?? 255) * a + 255 * (1 - a)
    const b  = (data[i + 2] ?? 255) * a + 255 * (1 - a)
    return (r + g + b) / 3
  }

  // Trim trailing blank rows, keep 32 rows of bottom padding.
  let trimRow = height
  for (let ty = height - 1; ty >= 0; ty--) {
    let hasDark = false
    for (let tx = 0; tx < targetWidth; tx++) {
      if (bright(tx, ty) < 200) { hasDark = true; break }
    }
    if (hasDark) { trimRow = ty + 32; break }
  }
  const rows = Math.min(Math.max(trimRow, 1), height)

  // Build the full bitmap (1 bit per pixel, MSB = leftmost dot).
  const bytesPerRow = Math.ceil(targetWidth / 8)  // 576 / 8 = 72
  const bitmap = Buffer.alloc(rows * bytesPerRow, 0)
  for (let ty = 0; ty < rows; ty++) {
    for (let bx = 0; bx < bytesPerRow; bx++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const tx = bx * 8 + bit
        if (tx < targetWidth && bright(tx, ty) < 200) {
          byte |= (0x80 >> bit)
        }
      }
      bitmap[ty * bytesPerRow + bx] = byte
    }
  }

  // GS v 0 parameters (xL, xH = bytes per row; yL, yH = rows per strip).
  const xL = bytesPerRow & 0xFF        // 72
  const xH = (bytesPerRow >> 8) & 0xFF //  0
  const STRIP = 50                      // rows per strip

  const chunks: Buffer[] = [
    Buffer.from([0x1B, 0x40]),  // ESC @ – reset
  ]

  for (let start = 0; start < rows; start += STRIP) {
    const end = Math.min(start + STRIP, rows)
    const yL = (end - start) & 0xFF
    const yH = ((end - start) >> 8) & 0xFF
    chunks.push(Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]))
    chunks.push(bitmap.subarray(start * bytesPerRow, end * bytesPerRow))
  }

  chunks.push(
    Buffer.from([0x0A, 0x0A, 0x0A, 0x0A]), // 4 LF feeds before cut
    Buffer.from([0x1D, 0x56, 0x42, 0x00]), // GS V B – partial cut
  )
  return Buffer.concat(chunks)
}

// ── Persistent print window ────────────────────────────────────────────────
// Created once, reused for every print job. Destroying and recreating a
// BrowserWindow between prints causes macOS Metal to release and reallocate
// the offscreen compositor surface — on the second window the surface may
// still be initialising when capturePage() is called, producing a blank or
// corrupt PNG that becomes gibberish on the printer.
// By keeping one window alive for the app's lifetime we eliminate that cycle.
let sharedPrintWin: import('electron').BrowserWindow | null = null
let printBusy = false

function getPrintWin(): import('electron').BrowserWindow {
  const { BrowserWindow } = require('electron') as typeof import('electron')
  if (sharedPrintWin && !sharedPrintWin.isDestroyed()) return sharedPrintWin
  sharedPrintWin = new BrowserWindow({
    width: 288,          // = 576 physical px at scaleFactor:2 → exact 576-dot bitmap
    height: 5000,
    show: false,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      offscreen: true,
      scaleFactor: 2,    // always 2× regardless of host display DPR
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  // Paint listener is required to activate the offscreen compositor.
  // Without at least one observer Chromium never generates frames.
  sharedPrintWin.webContents.on('paint', () => {})
  return sharedPrintWin
}

// ── IPC handlers ──────────────────────────────────────────────────────────
export function registerPrintHandlers(): void {

  ipcMain.handle(
    'print:receipt',
    async (
      _event,
      bill: BillWithCustomer,
      lines: BillLineWithDetail[],
      business: BusinessRow,
      printerIp?: string,
    ) => {
      if (printBusy) return { ok: false, error: 'प्रिन्टर व्यस्त छ, कृपया पर्खनुस्' }
      printBusy = true

      console.log('[print] start — via:', printerIp ? `TCP ${printerIp}` : 'CUPS')

      const ts = Date.now()
      const tmp = app.getPath('temp')
      const htmlPath = path.join(tmp, `receipt-${ts}.html`)
      const binPath  = path.join(tmp, `receipt-${ts}.bin`)
      const cleanup = () => { for (const f of [htmlPath, binPath]) fs.unlink(f, () => {}) }

      try {
        // Step 1: Write receipt HTML to temp file
        fs.writeFileSync(htmlPath, buildReceiptHtml(bill, lines, business), 'utf8')

        // Step 1b: Send ESC @ to the printer now, before rendering starts.
        // This gives the printer ~600 ms to process the reset while Chromium
        // renders the receipt — belt-and-suspenders alongside the post-job reset
        // embedded at the end of each ESC/POS stream.
        if (printerIp && printerIp.trim()) {
          await sendResetViaTcp(printerIp.trim(), 9100)
        }

        // Step 2: Load into the persistent window.
        // Navigate to about:blank first to flush all stale compositor tiles from
        // the previous print job (large bold Devanagari text lands in its own
        // compositing layer that Chromium does not invalidate on same-window
        // navigation, causing the previous business name to bleed into the next
        // capture). about:blank is instantaneous and does not release the GPU
        // surface, so capturePage() on the subsequent load remains reliable.
        const win = getPrintWin()
        await win.loadURL('about:blank')
        await win.loadURL(pathToFileURL(htmlPath).href)

        // Step 3: Wait for the page to signal it is fully rendered.
        //
        // The HTML sets data-print-ready="1" on <body> after two rAFs, which
        // guarantees layout, Devanagari shaping, and at least one paint commit
        // have all completed. We poll for that attribute (every 50 ms) rather
        // than sleeping a fixed amount — this is reliable regardless of bill
        // complexity and avoids capturing a partially-rendered PNG.
        await win.webContents.executeJavaScript(`
          new Promise(function(resolve) {
            (function poll() {
              if (document.body.getAttribute('data-print-ready') === '1') resolve();
              else setTimeout(poll, 50);
            })();
            setTimeout(resolve, 5000);
          })
        `)
        // Extra margin: Devanagari glyph rasterisation happens asynchronously in
        // the compositor after fonts report ready — give it time to complete.
        // On warm-cache (second+ print) the overall load is faster, so rasterisation
        // may still be in-flight when the rAF fires — 600 ms gives more headroom.
        await new Promise(r => setTimeout(r, 600))

        // Step 4: Measure and capture.
        const contentHeight = await win.webContents.executeJavaScript(
          'document.body.scrollHeight'
        ) as number

        const captureRect = { x: 0, y: 0, width: 288, height: Math.max(contentHeight, 50) }
        const nativeImg  = await win.webContents.capturePage(captureRect)
        const pngBuffer  = nativeImg.toPNG()
        const sz = nativeImg.getSize()

        console.log('[print] captured', sz.width, 'x', sz.height, 'px —', pngBuffer.length, 'bytes')

        // scaleFactor:2 must produce a 576px-wide PNG. If it doesn't, Electron
        // ignored the hint and we'd be 2× upscaling 288→576 in pngToEscPos,
        // which turns sharp text into blocky garbled dots.
        if (sz.width !== 576) {
          return {
            ok: false,
            error: `Capture is ${sz.width}px wide (expected 576). Restart the app and try again.`,
          }
        }

        if (pngBuffer.length < 3000) {
          return { ok: false, error: 'Capture returned blank image — please try again' }
        }

        // Step 5: PNG → ESC/POS (scale = 1.0: 576 physical px → 576 printer dots)
        const escData = pngToEscPos(pngBuffer, 576)
        console.log('[print] ESC/POS:', escData.length, 'bytes')

        // Step 6: Send — TCP direct, Windows spooler, or CUPS fallback
        if (printerIp && printerIp.trim()) {
          await sendViaTcp(printerIp.trim(), 9100, escData)
          console.log('[print] sent via TCP to', printerIp.trim())
        } else if (process.platform === 'win32') {
          await windowsPrint(htmlPath)
        } else {
          await cupsRawFallback(escData, binPath)
        }

        // Hold printBusy while the printer physically prints.
        // sendViaTcp resolves when the OS has flushed bytes to the NIC — the
        // thermal head may still be moving for several seconds. A second job
        // arriving while the head is active corrupts the printer firmware state
        // (requires hardware reboot). 4 s covers a ~300 mm receipt at 70 mm/s.
        await new Promise(r => setTimeout(r, 4000))

        setTimeout(cleanup, 5000)
        return { ok: true }

      } catch (e) {
        cleanup()
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[print] error:', msg)
        return { ok: false, error: msg }
      } finally {
        printBusy = false
        // Do NOT close sharedPrintWin — kept alive to avoid GPU surface teardown
      }
    },
  )

  // PDF viewer — opens in Preview for manual print (dev helper)
  ipcMain.handle('print:pdf', async (event) => {
    const { BrowserWindow, shell } = require('electron') as typeof import('electron')
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { ok: false, error: 'No window found' }
    try {
      const pdfData = await win.webContents.printToPDF({
        pageSize: { width: 80000, height: 297000 },
        printBackground: false,
        margins: { marginType: 'none' },
      })
      const filePath = path.join(app.getPath('temp'), `receipt-${Date.now()}.pdf`)
      fs.writeFileSync(filePath, pdfData)
      await new Promise<void>((resolve) => {
        exec(`open "${filePath}"`, (err) => { if (err) shell.openPath(filePath); resolve() })
      })
      setTimeout(() => fs.unlink(filePath, () => {}), 60000)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('print:window', async (event) => {
    const { BrowserWindow, shell } = require('electron') as typeof import('electron')
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { ok: false, error: 'No window found' }
    try {
      const pdfData = await win.webContents.printToPDF({
        pageSize: { width: 80000, height: 297000 },
        printBackground: false,
        margins: { marginType: 'none' },
      })
      const filePath = path.join(app.getPath('temp'), `receipt-${Date.now()}.pdf`)
      fs.writeFileSync(filePath, pdfData)
      await new Promise<void>((resolve) => {
        exec(`open "${filePath}"`, (err) => { if (err) shell.openPath(filePath); resolve() })
      })
      setTimeout(() => fs.unlink(filePath, () => {}), 60000)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })
}
