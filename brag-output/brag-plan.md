# /brag plan — Badachuli Rice Mill

Run: 2026-10-05 · path: `/brag-slim` (full `/brag` skipped — Hyperframes not installed, user chose the bundled slim path)
Format: landscape 1920×1080 @ 30fps · Duration 22.40s (672 frames) · Music on · SFX on · Voice off

---

## What it is

An offline-first Electron desktop app that replaces the paper ledgers at **Badachuli Rice Mill**
(बडचुली राइस मिल) in Kawasoti, Nawalpur, Nepal. The mill runs primarily as a *service*: walk-in
customers bring their own grain (धान, मकै, गहु, कोदो, तोरी), the mill processes it, and the customer
takes the output home. The app covers that whole cycle — billing, processing, inventory, customer
credit (उधारो), suppliers, expenses, reports — and prints 80mm ESC/POS thermal bills in Nepali with
Bikram Sambat dates, with **zero internet dependency**.

- Who it's for: one owner-operator, on a 4GB Windows PC, in a mill with no reliable internet.
- What sets it apart: it's bilingual Nepali/English down to the numerals (रु.२,११५.००), it prints real
  thermal receipts in Bikram Sambat, and its architecture is ledger-centric — stock and totals are
  always *computed from transactions*, never stored.
- Most impressive claim (from `Docs/01_SYSTEM_OVERVIEW.md`): "Operate 100% offline with zero internet
  dependency for all core operations."
- Visual hook: the real 80mm receipt. Devanagari, dashed dividers, Nepali numerals. Unmistakably this mill.

## Angle

**A quiet premium product film for a real family mill.** Tone preset: `polished`.
No jokes, no SaaS language. The story carries it: a paper ledger became software, and the
software prints in the language the mill actually speaks. Earnest and warm, dark warm stage,
the product's own orange.

## Visual identity (lifted from the app, not invented)

| | |
|---|---|
| Stage | `#1c1917` (the app's real sidebar colour) with a warm radial glow |
| Primary | `#f97316` — `--primary: 24.6 95% 53.1%` |
| Accent | `#facc15` — `--accent: 45 96% 53%` |
| App background | `#f9f7f4` — `--background: 30 20% 97%` |
| Paper | `#ffffff`, `.receipt` at 72mm |
| Logo | `resources/logo.svg` (orange `#ED9A16` + green `#489900`) |
| Type | the app's own stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |

**Everything on screen is the real thing**: scenes load the app's compiled Tailwind + `globals.css`
(`work/app.css`) and reuse the actual class names and markup from `Sidebar.tsx`, `DashboardPage.tsx`,
`NewBillPage.tsx` and `PrintReceipt.tsx`. Nothing is a mockup of the UI; it *is* the UI.

## Data on screen

Real catalog names and real price points from `dev.db` (धान @ रु.2/kg processing, चामल @ रु.75/kg,
units kg). Real business name and address. **Substituted:** the PAN number (`३०९८७६५४३` — fictional,
not the mill's) and the customer name (`श्री हरि प्रसाद`, fictional). Bill number follows the documented
format `<PREFIX>-<FY_BS>-<SEQ>` → `BC-2083-00142`; the prefix is a configurable mill setting, and the
short one is used because the documented `BRM` example overflows the 72mm paper by 1px and wraps
(see the note below). Date is today's real BS date, computed with the app's own `adToBS`: १९ असोज २०८३.

### One real defect found while building this

`.receipt-bill-meta` is a `space-between` flex row with no gap, and on a 72mm receipt
`बिल नं : BRM-2083-00142` + `मिति : १९ असोज २०८३` measures 250px inside a 249px box — so the on-screen
print preview wraps the bill number mid-token. Only the preview is affected; the actual thermal output
is built as ESC/POS bytes in `src/main/ipc/print.ts`, not from this markup.

## Storyboard

Tempo 75 BPM — beat = 0.8s, bar = 3.2s. Every cut lands on a beat; the whole film is 7 bars.

| # | Scene | In–Out | Len | On screen | Text | Audio |
|---|---|---|---|---|---|---|
| 1 | **Hook — the paper** | 0.00–3.20 | 3.20 | The real `.receipt` at 2.03×, rising slowly out of the dark on warm paper with a long shadow and a torn feed edge | "This bill was written by hand." (settles 0.95s, holds 1.95s) | Pad opens quiet on Dmaj7, sub on bar 1, a soft swell under the rising paper |
| 2 | **Title** | 3.20–5.60 | 2.40 | Receipt exits upward; `resources/logo.svg` (the mill's wheat mark) fades in with the wordmark | "Badachuli Rice Mill" / "बडचुली राइस मिल" | Chord moves to A/C#; one struck bell |
| 3 | **Reveal — the app** | 5.60–8.80 | 3.20 | App window scales 0.955→1; the real sidebar staggers in row by row, 4 real `StatCard`s stagger, the 7-day bars grow | "Replaces the mill's paper ledger." (settles 6.70s) | Bm7; a soft bell on each stat card; arpeggio enters |
| 4 | **Billing** | 8.80–12.80 | 4.00 | Content swaps to New Bill. Types `धान` → real dropdown → qty `120` → line lands; then `चामल` 25 × 75; Grand Total counts up to Rs. 2,115.00, Collected now Rs. 1,500.00, Credit (Due) Rs. 615.00; Review & Save presses | "Keyboard-first. Type, Enter, done." (settles 9.65s) | G; key taps mixed well under, a bell as each line lands, a firmer one on save |
| 5 | **The receipt prints** | 12.80–16.80 | 4.00 | The receipt feeds out over the fading window, top-first like thermal paper, and settles centre: बिल नं BC-2083-00142, मिति १९ असोज २०८३, grouped बिक्री / प्रशोधन, जम्मा, बाँकी | "Prints in Nepali. Dates in Bikram Sambat." (settles 13.80s) | Back to D, pad dips so the printer feed reads; arpeggio rests |
| 6 | **Offline / the ledger** | 16.80–20.00 | 3.20 | Window returns to the dashboard; an Offline pill appears in the header and the Total-outstanding row lifts | "Totals computed from the ledger. Offline." (settles 17.70s) | A; arpeggio back, bell on the pill, low swell building |
| 7 | **Outro** | 20.00–22.40 | 2.40 | Dip to dark. Mill mark + wordmark, and the receipt's own sign-off beneath | "Badachuli Rice Mill" / "धन्यवाद!" | Resolve to Dmaj7, two struck bells, long tail |

**Transitions.** The app window is the constant through scenes 3, 4 and 6, so content swaps are *staggered*
(dashboard out 8.80–9.02, New Bill in 9.02–9.42) rather than crossfaded — no muddy double exposure.
Scenes 1→2 and 6→7 dip through the dark stage. Scene 4→5 is continuous: the receipt prints out *over*
the window as it fades, so the bill visibly comes from the screen that made it.

## Sound

One piece, written as one piece: a warm pad (D – A/C# – Bm7 – G, 80 BPM), a sparse bell arpeggio
that enters with the app, a low sub on bar starts, and a final swell that resolves. Every effect is
pitched into that chord — card and line reveals are soft bells on chord tones, not clicks on top of
the music; the key taps and the printer feed are filtered noise sitting well under the pad. Mixed with
effects at −30 to −34 dBFS under a −20 dBFS bed, then `loudnorm` to −14 LUFS.
Synthesized from scratch in `work/audio.mjs` (no bundled assets in the slim path, and no sox on this box).

## Share caption

> Badachuli Rice Mill ran on paper ledgers. Now it runs on this — billing, processing and inventory
> for a Nepali rice mill, printing 80mm thermal receipts in Nepali with Bikram Sambat dates. Every
> total computed from the ledger. No internet, ever.

## Build

Chrome headless driven over CDP (`work/capture.mjs`, zero npm deps) → 675 PNGs → ffmpeg h264.
Every frame is a pure function of `t`: all motion is computed in JS from `window.setT(t)`, no CSS
transitions or animations, fonts and images awaited before the first capture.
