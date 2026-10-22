import { writeFileSync } from 'node:fs'
const ROOT = '/Users/bimochanbhattarai/Projects/Badachuli/node_modules/lucide-react/dist/esm/icons'
const names = ['layout-dashboard','receipt-text','clipboard-list','users','book-open',
  'package-plus','boxes','truck','cpu','package','tag','ruler','wallet',
  'settings','user','log-out','cog','trending-up','circle-alert','calendar','refresh-cw','chart-column','circle-check-big',
  'ticket','plus','chevron-left','wifi-off','x']
const out = {}
for (const n of names) {
  const mod = await import(ROOT + '/' + n + '.mjs')
  const node = mod.__iconNode
  if (!node) { console.error('NO __iconNode:', n, Object.keys(mod)); continue }
  out[n] = node.map(([tag, attrs]) => {
    const a = Object.entries(attrs).filter(([k]) => k !== 'key')
      .map(([k, v]) => `${k}="${v}"`).join(' ')
    return `<${tag} ${a}/>`
  }).join('')
}
writeFileSync('/Users/bimochanbhattarai/Projects/Badachuli/brag-output/work/icons.js',
  'window.ICONS=' + JSON.stringify(out) + ';\n' +
  `window.icon=function(n,cls,sz){return '<svg class="'+(cls||'')+'" width="'+(sz||24)+'" height="'+(sz||24)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(window.ICONS[n]||'')+'</svg>'};\n`)
console.log('icons written:', Object.keys(out).length, '/', names.length)
