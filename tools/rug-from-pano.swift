// A seamless rug texture cut from a 360 photo (img2threejs "projection-first fidelity": the photo's own pixels
// instead of a procedural imitation). The input is a straight-down view of the floor cut from a panorama
// (work/i2t/panoview.swift with pitch -89.9); a square patch of evenly lit rug is
//   1. de-lit: divided by a heavily blurred copy of itself, so sun streaks and soft shadows go and only the
//      pattern stays (then scaled back to the patch's mean colour);
//   2. made seamless: blended with a copy shifted by half a tile, the copy taking over near the edges;
//   3. turned into a normal map from its brightness (pile tips are lighter than the dips between them).
// Usage: rug-from-pano <in> <x> <y> <size> <out-prefix> [r,g,b]   (writes <out-prefix>.jpg and <out-prefix>_n.jpg,
// 1024 px; the optional r,g,b is the linear mean colour to give the result, for a patch cut from a dim part of a photo)
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil)!
let full = CGImageSourceCreateImageAtIndex(src, 0, nil)!
let px = Int(a[2])!, py = Int(a[3])!, size = Int(a[4])!, out = a[5]
let N = 1024
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let crop = full.cropping(to: CGRect(x: px, y: py, width: size, height: size))!
var rgb = [Float](repeating: 0, count: N * N * 3)
do {
  var buf = [UInt8](repeating: 0, count: N * N * 4)
  buf.withUnsafeMutableBytes { b in
    let ctx = CGContext(data: b.baseAddress, width: N, height: N, bitsPerComponent: 8, bytesPerRow: N * 4, space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    ctx.interpolationQuality = .high
    ctx.draw(crop, in: CGRect(x: 0, y: 0, width: N, height: N))
  }
  for i in 0..<(N * N) { for c in 0..<3 { rgb[i * 3 + c] = pow(Float(buf[i * 4 + c]) / 255, 2.2) } } // to linear
}
// box blur (repeated = gaussian-like), wrapping at the edges
func blur(_ src: [Float], _ r: Int, _ passes: Int) -> [Float] {
  var cur = src, tmp = src
  for _ in 0..<passes {
    for y in 0..<N { for c in 0..<3 {
      var s: Float = 0
      for k in -r...r { s += cur[((y * N) + ((k % N) + N) % N) * 3 + c] }
      for x in 0..<N {
        tmp[(y * N + x) * 3 + c] = s / Float(2 * r + 1)
        s += cur[(y * N + (x + r + 1) % N) * 3 + c] - cur[(y * N + ((x - r) % N + N) % N) * 3 + c]
      }
    } }
    for x in 0..<N { for c in 0..<3 {
      var s: Float = 0
      for k in -r...r { s += tmp[((((k % N) + N) % N) * N + x) * 3 + c] }
      for y in 0..<N {
        cur[(y * N + x) * 3 + c] = s / Float(2 * r + 1)
        s += tmp[(((y + r + 1) % N) * N + x) * 3 + c] - tmp[((((y - r) % N + N) % N) * N + x) * 3 + c]
      }
    } }
  }
  return cur
}
// 1. de-light
let low = blur(rgb, 48, 3)
var mean: [Float] = [0, 0, 0]
for i in 0..<(N * N) { for c in 0..<3 { mean[c] += rgb[i * 3 + c] } }
for c in 0..<3 { mean[c] /= Float(N * N) }
let target: [Float] = a.count > 6 ? a[6].split(separator: ",").map { Float($0)! } : mean
var flat = rgb
for i in 0..<(N * N) { for c in 0..<3 { flat[i * 3 + c] = rgb[i * 3 + c] / max(0.02, low[i * 3 + c]) * target[c] } }
// 2. seamless, one direction at a time: a copy shifted by half a tile takes over near the top and bottom edges (its
//    own seam then sits in the middle, where it has no weight), then the same across. Shifting both ways at once
//    would leave the shifted copy's cross-shaped seam showing near the borders.
func edgeWeight(_ i: Int) -> Float {
  let f = Float(i) / Float(N - 1), e = min(f, 1 - f) * 2 // 0 at the border, 1 in the middle
  let w = 1 - min(1, max(0, e / 0.35))
  return w * w * (3 - 2 * w)
}
var vert = flat
for y in 0..<N { let sw = edgeWeight(y), sy = (y + N / 2) % N
  for x in 0..<N { for c in 0..<3 { vert[(y * N + x) * 3 + c] = flat[(y * N + x) * 3 + c] * (1 - sw) + flat[(sy * N + x) * 3 + c] * sw } } }
var tile = vert
for x in 0..<N { let sw = edgeWeight(x), sx = (x + N / 2) % N
  for y in 0..<N { for c in 0..<3 { tile[(y * N + x) * 3 + c] = vert[(y * N + x) * 3 + c] * (1 - sw) + vert[(y * N + sx) * 3 + c] * sw } } }
// 3. normal map from brightness (detail only)
var lum = [Float](repeating: 0, count: N * N)
for i in 0..<(N * N) { lum[i] = 0.3 * tile[i * 3] + 0.59 * tile[i * 3 + 1] + 0.11 * tile[i * 3 + 2] }
func L(_ x: Int, _ y: Int) -> Float { lum[((y + N) % N) * N + ((x + N) % N)] }
let strength: Float = 6
var nrm = [UInt8](repeating: 255, count: N * N * 4), col = [UInt8](repeating: 255, count: N * N * 4)
for y in 0..<N { for x in 0..<N {
  let dx = (L(x + 1, y) - L(x - 1, y)) * strength, dy = (L(x, y + 1) - L(x, y - 1)) * strength
  var n = (-dx, dy, Float(1)); let l = (n.0 * n.0 + n.1 * n.1 + 1).squareRoot(); n = (n.0 / l, n.1 / l, n.2 / l)
  let o = (y * N + x) * 4
  nrm[o] = UInt8(max(0, min(255, (n.0 * 0.5 + 0.5) * 255))); nrm[o + 1] = UInt8(max(0, min(255, (n.1 * 0.5 + 0.5) * 255))); nrm[o + 2] = UInt8(max(0, min(255, (n.2 * 0.5 + 0.5) * 255)))
  for c in 0..<3 { col[o + c] = UInt8(max(0, min(255, pow(max(0, tile[(y * N + x) * 3 + c]), 1 / 2.2) * 255))) }
} }
func save(_ px: [UInt8], _ path: String) {
  var b = px
  b.withUnsafeMutableBytes { m in
    let ctx = CGContext(data: m.baseAddress, width: N, height: N, bitsPerComponent: 8, bytesPerRow: N * 4, space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, ctx.makeImage()!, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
    CGImageDestinationFinalize(d)
  }
}
save(col, out + ".jpg")
save(nrm, out + "_n.jpg")
print("wrote \(out).jpg and \(out)_n.jpg; mean colour (linear) \(mean.map { String(format: "%.3f", $0) })")
