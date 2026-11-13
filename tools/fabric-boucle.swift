// Tiling "pebble" boucle maps, matched to the Grand Living upholstery seen in the 12K panoramas: irregular closed
// loops 11-15 mm across with deep gaps between them (measured from a straight-on 12K crop; see
// work/i2t/club/fabric-h54.png and the img2threejs PBR evidence in work/i2t/club/pbr-h54/report.json).
// One tile is 0.25 m, so the material repeats 4 times per metre.
//
// Usage: swift tools/fabric-boucle.swift <out-folder> [loops across, default 20; the app uses 30] [seed, default 7]
// Writes fab_pebble_n.jpg (tangent-space normal map) and fab_pebble_c.jpg (albedo/cavity multiplier, light grey).
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let outDir = args.count > 1 ? args[1] : "public/tex"
let cells = args.count > 2 ? Int(args[2])! : 20
var seed: UInt64 = args.count > 3 ? UInt64(args[3])! : 7
let N = 1024
func rnd() -> Double { seed = seed &* 6364136223846793005 &+ 1442695040888963407; return Double(seed >> 11) / Double(1 << 53) }

// jittered feature points, one per cell, with a per-loop height and a slight stretch (loops are not round)
struct P { var x: Double; var y: Double; var h: Double; var a: Double; var e: Double }
var pts: [P] = []
// a finer second layer of cells creases the top of every loop (the yarn folds over itself)
let cells2 = cells * 2 + 7
var pts2: [(Double, Double)] = []
for j in 0..<cells { for i in 0..<cells {
  pts.append(P(x: (Double(i) + 0.15 + 0.7 * rnd()) / Double(cells), y: (Double(j) + 0.15 + 0.7 * rnd()) / Double(cells),
               h: 0.72 + 0.28 * rnd(), a: rnd() * .pi, e: 1.0 + 0.45 * rnd()))
} }
for j in 0..<cells2 { for i in 0..<cells2 { pts2.append(((Double(i) + 0.1 + 0.8 * rnd()) / Double(cells2), (Double(j) + 0.1 + 0.8 * rnd()) / Double(cells2))) } }
let cs = 1.0 / Double(cells), cs2 = 1.0 / Double(cells2)
func crease(_ u: Double, _ v: Double) -> Double {
  let ci = Int(u * Double(cells2)), cj = Int(v * Double(cells2))
  var d1 = 1e9, d2 = 1e9
  for dj in -1...1 { for di in -1...1 {
    let ii = ((ci + di) % cells2 + cells2) % cells2, jj = ((cj + dj) % cells2 + cells2) % cells2
    var dx = pts2[jj * cells2 + ii].0 - u, dy = pts2[jj * cells2 + ii].1 - v
    dx -= dx.rounded(); dy -= dy.rounded()
    let d = (dx * dx + dy * dy).squareRoot()
    if d < d1 { d2 = d1; d1 = d } else if d < d2 { d2 = d }
  } }
  return min(1, (d2 - d1) / cs2 / 0.35)
}
var height = [Double](repeating: 0, count: N * N)
var shade = [Double](repeating: 0, count: N * N)
// a little fibre noise on top (value noise, periodic)
func hash(_ x: Int, _ y: Int) -> Double { var h = UInt64(truncatingIfNeeded: x &* 374761393 &+ y &* 668265263) ^ 0x9E3779B97F4A7C15; h = (h ^ (h >> 13)) &* 1274126177; return Double(h & 0xffff) / 65535.0 }
func vnoise(_ u: Double, _ v: Double, _ f: Int) -> Double {
  let x = u * Double(f), y = v * Double(f), xi = Int(floor(x)), yi = Int(floor(y)), fx = x - floor(x), fy = y - floor(y)
  let sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  func g(_ a: Int, _ b: Int) -> Double { hash(((a % f) + f) % f, ((b % f) + f) % f) }
  return (g(xi, yi) * (1 - sx) + g(xi + 1, yi) * sx) * (1 - sy) + (g(xi, yi + 1) * (1 - sx) + g(xi + 1, yi + 1) * sx) * sy
}
for py in 0..<N {
  for px in 0..<N {
    let u = (Double(px) + 0.5) / Double(N), v = (Double(py) + 0.5) / Double(N)
    let ci = Int(u * Double(cells)), cj = Int(v * Double(cells))
    var d1 = 1e9, d2 = 1e9, best = 0
    for dj in -2...2 { for di in -2...2 {
      let ii = ((ci + di) % cells + cells) % cells, jj = ((cj + dj) % cells + cells) % cells
      let p = pts[jj * cells + ii]
      // nearest periodic copy
      var dx = p.x - u, dy = p.y - v
      dx -= (dx).rounded(); dy -= (dy).rounded()
      // stretched metric per loop
      let c = cos(p.a), s = sin(p.a)
      let lx = (dx * c + dy * s) / p.e, ly = (-dx * s + dy * c) * p.e
      let d = (lx * lx + ly * ly).squareRoot()
      if d < d1 { d2 = d1; d1 = d; best = jj * cells + ii } else if d < d2 { d2 = d }
    } }
    let edge = (d2 - d1) / cs // 0 on the gap between two loops
    let p = pts[best]
    // a loop is a soft dome: steep sides into the gap, rounded top
    // each loop is a rounded nub (a cap around its centre) that falls into a dark gap where it meets its neighbours
    let t = min(1, edge / 0.7)
    let cap = pow(max(0, 1 - pow(d1 / (cs * 0.7), 2.0)), 0.5)
    let dome = cap * pow(t, 0.35)
    let fib = vnoise(u, v, 256) * 0.5 + vnoise(u, v, 128) * 0.5
    let fold = crease(u, v)
    height[py * N + px] = p.h * dome * (0.8 + 0.2 * fold) + 0.05 * fib
    shade[py * N + px] = p.h
  }
}
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
func save(_ name: String, _ px: [UInt8]) {
  var buf = px
  buf.withUnsafeMutableBytes { b in
    let ctx = CGContext(data: b.baseAddress, width: N, height: N, bitsPerComponent: 8, bytesPerRow: N * 4, space: colorSpace, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    let img = ctx.makeImage()!
    let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: outDir + "/" + name) as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, img, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
    CGImageDestinationFinalize(d)
  }
}
// normal map from the height field (tile is 0.25 m: one pixel ~0.24 mm; relief ~4 mm deep)
let depthPx = 4.0 / (250.0 / Double(N))
var nrm = [UInt8](repeating: 255, count: N * N * 4)
var col = [UInt8](repeating: 255, count: N * N * 4)
func H(_ x: Int, _ y: Int) -> Double { height[((y + N) % N) * N + ((x + N) % N)] }
for y in 0..<N { for x in 0..<N {
  let dx = (H(x + 1, y) - H(x - 1, y)) * 0.5 * depthPx, dy = (H(x, y + 1) - H(x, y - 1)) * 0.5 * depthPx
  var nx = -dx, ny = dy, nz = 1.0 // image y runs down, texture v runs up
  let l = (nx * nx + ny * ny + nz * nz).squareRoot(); nx /= l; ny /= l; nz /= l
  let o = (y * N + x) * 4
  nrm[o] = UInt8(max(0, min(255, (nx * 0.5 + 0.5) * 255))); nrm[o + 1] = UInt8(max(0, min(255, (ny * 0.5 + 0.5) * 255))); nrm[o + 2] = UInt8(max(0, min(255, (nz * 0.5 + 0.5) * 255)))
  // albedo multiplier: loop tops near white with a little per-loop variation, gaps darker (fibre shadow)
  let h = height[y * N + x]
  // (kept light: the relief and its shading come from the normal map; this only adds the fibre shadow in the gaps)
  let k = min(1, max(0, h / 0.45)), sk = k * k * (3 - 2 * k)
  let c = (0.95 + 0.05 * (shade[y * N + x] - 0.72) / 0.28) * (0.6 + 0.4 * sk)
  let g = UInt8(max(0, min(255, c * 255)))
  col[o] = g; col[o + 1] = g; col[o + 2] = UInt8(max(0, min(255, Double(g) * 0.985)))
} }
save("fab_pebble_n.jpg", nrm)
save("fab_pebble_c.jpg", col)
print("wrote \(outDir)/fab_pebble_n.jpg and fab_pebble_c.jpg (\(cells) loops across a 0.25 m tile)")
