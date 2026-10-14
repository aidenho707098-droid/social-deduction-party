// Colour-distance maths for the Colors palette check
// (palette.selftest.mjs): simulate protan / deutan / tritan vision
// (Machado et al. 2009, full severity, in linear RGB) and measure CIEDE2000
// between every pair of swatches. Plain JS, no dependencies.

const CVD = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function hexToLin(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLin(v / 255))
}

function simulate(lin, kind) {
  if (!kind) return lin
  const m = CVD[kind]
  return m.map((row) => Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])))
}

function linToLab([r, g, b]) {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const [fx, fy, fz] = [f(X), f(Y), f(Z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

// CIEDE2000.
function de2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cb = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const ap1 = (1 + G) * a1
  const ap2 = (1 + G) * a2
  const Cp1 = Math.hypot(ap1, b1)
  const Cp2 = Math.hypot(ap2, b2)
  const hp = (b, a) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360)
  const h1 = hp(b1, ap1)
  const h2 = hp(b2, ap2)
  const dL = L2 - L1
  const dC = Cp2 - Cp1
  let dh = h2 - h1
  if (Cp1 * Cp2 === 0) dh = 0
  else if (dh > 180) dh -= 360
  else if (dh < -180) dh += 360
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad)
  const Lb = (L1 + L2) / 2
  const Cpb = (Cp1 + Cp2) / 2
  let hb = h1 + h2
  if (Cp1 * Cp2 !== 0) hb = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hb - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2)
  const Sc = 1 + 0.045 * Cpb
  const Sh = 1 + 0.015 * Cpb * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))
}

// The closest pair of `hexes` under normal vision and each CVD type.
export function closestPairs(hexes) {
  const out = {}
  for (const kind of [null, 'protan', 'deutan', 'tritan']) {
    const labs = hexes.map((h) => linToLab(simulate(hexToLin(h), kind)))
    let min = { de: Infinity }
    for (let i = 0; i < labs.length; i++) {
      for (let j = i + 1; j < labs.length; j++) {
        const de = de2000(labs[i], labs[j])
        if (de < min.de) min = { de, a: hexes[i], b: hexes[j] }
      }
    }
    out[kind ?? 'normal'] = min
  }
  return out
}
