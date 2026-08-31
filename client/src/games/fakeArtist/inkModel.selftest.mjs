// Pure unit check for the Fake Artist ink-limit geometry.
// Run:  node client/src/games/fakeArtist/inkModel.selftest.mjs

import {
  INK_LIMIT,
  strokeLength,
  totalInk,
  inkFraction,
  inkExhausted,
  clampMove,
} from './inkModel.js'

let failures = 0
function check(name, cond, detail = '') {
  const ok = Boolean(cond)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

// --- stroke / total length --------------------------------------
check('empty stroke has length 0', strokeLength([]) === 0)
check('single point has length 0', strokeLength([{ x: 5, y: 5 }]) === 0)
check(
  'a 3-4-5 triangle path measures 3 + 4 = 7',
  approx(strokeLength([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }]), 7)
)
check(
  'totalInk sums across strokes',
  approx(
    totalInk([
      { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      { points: [{ x: 0, y: 0 }, { x: 0, y: 20 }] },
    ]),
    30
  )
)

// --- fraction / exhausted --------------------------------------
check('fraction is 1 with no ink used', inkFraction([]) === 1)
check('nothing drawn is not exhausted', inkExhausted([]) === false)
{
  const half = [{ points: [{ x: 0, y: 0 }, { x: INK_LIMIT / 2, y: 0 }] }]
  check('halfway budget -> fraction ~0.5', approx(inkFraction(half), 0.5))
  check('halfway budget -> not exhausted', inkExhausted(half) === false)
}
{
  const over = [{ points: [{ x: 0, y: 0 }, { x: INK_LIMIT * 2, y: 0 }] }]
  check('over budget -> fraction clamps to 0', inkFraction(over) === 0)
  check('over budget -> exhausted', inkExhausted(over) === true)
}

// --- clampMove: the core limiter -----------------------------
{
  // Budget fully available, short move fits untouched.
  const r = clampMove([], { x: 0, y: 0 }, { x: 100, y: 0 })
  check('a move within budget is unchanged', r.point.x === 100 && r.exhausted === false)
}
{
  // 200 spent already, then try to move 900 more with a 1000 limit ->
  // only 800 of it is allowed, landing exactly on the limit.
  const strokes = [{ points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] }]
  const r = clampMove(strokes, { x: 200, y: 0 }, { x: 200 + 900, y: 0 }, 1000)
  check('a move past the budget is clamped', approx(r.point.x, 1000) && r.exhausted === true)
  check(
    'after the clamped point the total sits exactly on the limit',
    approx(totalInk([...strokes, { points: [{ x: 200, y: 0 }, r.point] }]), 1000)
  )
}
{
  // Budget already gone: the move is refused, point stays put.
  const spent = [{ points: [{ x: 0, y: 0 }, { x: 1200, y: 0 }] }]
  const r = clampMove(spent, { x: 1200, y: 0 }, { x: 1300, y: 0 }, 1000)
  check('no budget left -> point does not move', r.point.x === 1200 && r.exhausted === true)
}
{
  // Diagonal clamp keeps the point ON the segment.
  const r = clampMove([], { x: 0, y: 0 }, { x: 300, y: 400 }, 250) // seg len 500, budget 250
  check('diagonal clamp stays on the line', approx(r.point.x, 150) && approx(r.point.y, 200))
  check('diagonal clamp spends exactly the budget', approx(strokeLength([{ x: 0, y: 0 }, r.point]), 250))
}

console.log(`\n${failures === 0 ? 'ALL INK MODEL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
