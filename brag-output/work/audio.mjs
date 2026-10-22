/* Badachuli /brag — one piece of music, 75 BPM, D major, 22.40s.
   Every effect is pitched into the chord and mixed under the bed. No deps. */
import { writeFileSync } from 'node:fs'

const SR = 48000, DUR = 22.40, N = Math.round(SR * DUR)
const L = new Float64Array(N), R = new Float64Array(N)
const BAR = 3.2, BEAT = 0.8

const add = (i, l, r) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r } }
const clamp = (x, a, b) => x < a ? a : x > b ? b : x

/* ── chords ─────────────────────────────────────────────── */
const D = [146.83, 220.00, 369.99, 440.00]
const AcC = [138.59, 220.00, 329.63, 440.00]
const Bm7 = [123.47, 185.00, 293.66, 440.00]
const G = [98.00, 146.83, 246.94, 293.66]
const A = [110.00, 164.81, 277.18, 329.63]
const BARS = [D, AcC, Bm7, G, D, A, D]
const SUBS = [73.42, 69.30, 61.74, 49.00, 73.42, 55.00, 73.42]

/* ── pad: slow-attack sines, gently detuned, bars crossfade ─ */
function pad(start, notes, gain, len = BAR + 0.95) {
  const atk = 0.62, rel = 1.05
  for (let k = 0; k < notes.length; k++) {
    const f = notes[k]
    const voiceGain = gain * (k === 0 ? 1.0 : k === 1 ? 0.72 : k === 2 ? 0.50 : 0.36)
    const panL = k % 2 === 0 ? 1.0 : 0.72, panR = k % 2 === 0 ? 0.72 : 1.0
    const det = (k % 2 === 0 ? 1 : -1) * 0.12
    for (let n = 0; n < Math.round(len * SR); n++) {
      const t = n / SR, i = Math.round(start * SR) + n
      if (i < 0 || i >= N) continue
      const e = Math.min(1, t / atk) * clamp((len - t) / rel, 0, 1)
      if (e <= 0) continue
      // slow breathing + a quiet 2nd partial for warmth
      const br = 1 + 0.015 * Math.sin(2 * Math.PI * 0.21 * (t + k))
      const s = Math.sin(2 * Math.PI * (f + det) * t * br)
        + 0.22 * Math.sin(2 * Math.PI * 2 * f * t)
        + 0.08 * Math.sin(2 * Math.PI * 3 * f * t)
      const v = s * e * voiceGain
      add(i, v * panL, v * panR)
    }
  }
}

/* ── sub: one soft low note per bar ─────────────────────── */
function sub(start, f, gain) {
  const len = 2.8
  for (let n = 0; n < Math.round(len * SR); n++) {
    const t = n / SR, i = Math.round(start * SR) + n
    const e = Math.min(1, t / 0.14) * Math.exp(-t / 1.5)
    const v = (Math.sin(2 * Math.PI * f * t) + 0.18 * Math.sin(2 * Math.PI * 2 * f * t)) * e * gain
    add(i, v, v)
  }
}

/* ── bell: struck chord tone, the only "effect" sound ───── */
function bell(start, f, gain, tau = 0.55, pan = 0) {
  const len = Math.min(3.2, tau * 7)
  const pl = 1 - Math.max(0, pan), pr = 1 + Math.min(0, pan)
  for (let n = 0; n < Math.round(len * SR); n++) {
    const t = n / SR, i = Math.round(start * SR) + n
    const e = Math.min(1, t / 0.004) * Math.exp(-t / tau)
    const v = (Math.sin(2 * Math.PI * f * t)
      + 0.30 * Math.exp(-t / (tau * 0.45)) * Math.sin(2 * Math.PI * f * 2.76 * t)
      + 0.14 * Math.exp(-t / (tau * 0.3)) * Math.sin(2 * Math.PI * f * 5.4 * t)) * e * gain
    add(i, v * pl, v * pr)
  }
}

/* ── filtered noise: paper, printer feed, key taps ──────── */
let seed = 12345
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1 }
function noise(start, len, gain, lo, hi, shape) {
  // 2-pole high-pass + 2-pole low-pass, one-pole cascade
  const aLo = Math.exp(-2 * Math.PI * hi / SR), aHi = Math.exp(-2 * Math.PI * lo / SR)
  let lp1 = 0, lp2 = 0, hp1 = 0, hp2 = 0, prev = 0
  for (let n = 0; n < Math.round(len * SR); n++) {
    const t = n / SR, i = Math.round(start * SR) + n
    let x = rnd()
    lp1 = lp1 * aLo + x * (1 - aLo); lp2 = lp2 * aLo + lp1 * (1 - aLo)
    hp1 = aHi * (hp1 + lp2 - prev); prev = lp2; hp2 = aHi * (hp2 + hp1 - hp2) + hp1 * 0.0
    const v = hp1 * gain * shape(t / len, t)
    add(i, v * 0.92, v)
  }
}

/* ── arrangement ────────────────────────────────────────── */
for (let b = 0; b < BARS.length; b++) {
  const s = b * BAR
  // a real arc: quiet open, build, dip under the printing receipt, lift to the resolve
  const g = [0.030, 0.042, 0.054, 0.060, 0.040, 0.066, 0.074][b]
  pad(s - (b === 0 ? 0 : 0.12), BARS[b], g, BAR + (b === BARS.length - 1 ? 2.6 : 0.95))
  if (b !== 4) sub(s, SUBS[b], b === 0 ? 0.080 : b >= 5 ? 0.098 : 0.082)
}

/* sparse bell arpeggio — enters with the app, rests for the receipt */
const ARP = [
  [5.60, 2], [6.40, 1], [7.20, 3], [8.00, 2],
  [8.80, 1], [9.60, 2], [10.40, 3], [11.20, 1], [12.00, 2],
  [16.80, 2], [17.60, 1], [18.40, 3], [19.20, 2], [20.00, 1],
]
for (const [t, k] of ARP) {
  const ch = BARS[Math.min(BARS.length - 1, Math.floor(t / BAR))]
  bell(t, ch[k] * 2, 0.048, 0.75, ((t * 7) % 2 - 1) * 0.3)
}

/* motion accents — each lands on something moving on screen */
bell(3.26, AcC[2] * 2, 0.062, 0.95, -0.1)                       // title
for (let i = 0; i < 4; i++) bell(6.30 + i * 0.10, Bm7[i] * 2, 0.034, 0.5, -0.4 + i * 0.27) // stat cards
bell(10.88, G[2] * 2, 0.046, 0.6, 0.2)                          // line 1 lands
bell(12.08, G[3] * 2, 0.046, 0.6, -0.2)                         // line 2 lands
bell(12.60, D[2] * 2, 0.068, 1.1, 0)                            // review & save
bell(17.52, A[2] * 2, 0.046, 0.8, 0.25)                         // offline pill
bell(20.30, D[2] * 2, 0.078, 2.2, 0)                            // outro
bell(20.30, D[1] * 2, 0.052, 2.6, 0)

/* paper rising out of the dark */
noise(0.10, 1.10, 0.028, 240, 2600, p => Math.sin(Math.PI * p) ** 1.6)
/* thermal printer feed, under the music */
noise(13.05, 1.35, 0.042, 700, 3400, (p, t) =>
  Math.min(1, p / 0.12) * clamp((1 - p) / 0.25, 0, 1) * (0.72 + 0.28 * Math.sin(2 * Math.PI * 21 * t)))
/* key taps while typing */
for (const [a, b] of [[9.55, 9.90], [10.40, 10.72], [11.20, 11.60], [11.80, 11.98]]) {
  for (let t = a; t < b; t += 0.085) noise(t, 0.035, 0.044, 1400, 6500, p => Math.exp(-p * 7))
}
/* swell into the outro */
noise(19.10, 1.30, 0.026, 90, 900, p => p ** 2.2)

/* ── master: soft-knee limit, dither-free 16-bit ─────────── */
let peak = 0
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
const norm = 0.72 / peak
const buf = Buffer.alloc(44 + N * 4)
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8)
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22)
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34)
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40)
const sat = x => Math.tanh(x * 1.12) / Math.tanh(1.12)
for (let i = 0; i < N; i++) {
  // 8 ms fade in, 0.5 s fade out so the tail lands clean
  const t = i / SR
  const fade = Math.min(1, t / 0.008) * clamp((DUR - t) / 0.5, 0, 1)
  buf.writeInt16LE(Math.round(sat(L[i] * norm) * fade * 32767), 44 + i * 4)
  buf.writeInt16LE(Math.round(sat(R[i] * norm) * fade * 32767), 46 + i * 4)
}
writeFileSync('music.wav', buf)
console.log(`music.wav  ${DUR}s  peak before norm ${peak.toFixed(3)}`)
