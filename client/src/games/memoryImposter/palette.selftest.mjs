// The Colors palette stays distinguishable: every pair of the six swatches
// is at least MIN_DE (CIEDE2000) apart under normal vision AND under
// simulated protanopia, deuteranopia and tritanopia (full severity).
//   node client/src/games/memoryImposter/palette.selftest.mjs
// (memoryData.js imports a React hook, so the hexes are read from source.)

import { readFileSync } from 'node:fs'
import { closestPairs } from './colorCheck.js'

const MIN_DE = 15

const src = readFileSync(new URL('./memoryData.js', import.meta.url), 'utf8')
const block = src.slice(src.indexOf('export const COLORS'), src.indexOf('}\n\n', src.indexOf('export const COLORS')))
const hexes = [...block.matchAll(/hex: '(#[0-9a-f]{6})'/gi)].map((m) => m[1])

let failures = 0
const check = (name, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

check('six swatches', hexes.length === 6, hexes.join(' '))
for (const [vision, p] of Object.entries(closestPairs(hexes))) {
  check(`${vision}: closest pair ΔE00 ≥ ${MIN_DE}`, p.de >= MIN_DE, `${p.de.toFixed(1)} (${p.a} / ${p.b})`)
}
console.log(failures === 0 ? '\nALL PALETTE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures ? 1 : 0)
