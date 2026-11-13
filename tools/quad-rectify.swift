// Straightens a flat picture seen at an angle in a photo (a framed artwork cut from a 360 photo with
// work/i2t/panoview.swift) into a front-on texture. The crop is a normal (rectilinear) view, so the picture's four
// corners are related to the output rectangle by a homography; each output pixel is sampled through it.
// Usage: quad-rectify <in> <out.jpg> <outW> <outH> <TLx,TLy> <TRx,TRy> <BRx,BRy> <BLx,BLy>
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count == 9, let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil),
      let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("usage: quad-rectify in out W H TL TR BR BL"); exit(1) }
let W = Int(a[3])!, H = Int(a[4])!
let q = a[5...8].map { s -> (Double, Double) in let p = s.split(separator: ",").map { Double($0)! }; return (p[0], p[1]) }
let sw = img.width, sh = img.height
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
var px = [UInt8](repeating: 0, count: sw * sh * 4)
px.withUnsafeMutableBytes { p in
  let ctx = CGContext(data: p.baseAddress, width: sw, height: sh, bitsPerComponent: 8, bytesPerRow: sw * 4, space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: sw, height: sh))
}
// unit square (0,0) (1,0) (1,1) (0,1) -> quad TL TR BR BL (Heckbert's square-to-quad mapping)
let (x0, y0) = q[0], (x1, y1) = q[1], (x2, y2) = q[2], (x3, y3) = q[3]
let dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2
let sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3
let den = dx1 * dy2 - dx2 * dy1
let g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den
let A = x1 - x0 + g * x1, B = x3 - x0 + h * x3, C = x0
let D = y1 - y0 + g * y1, E = y3 - y0 + h * y3, F = y0
var out = [UInt8](repeating: 255, count: W * H * 4)
for j in 0..<H {
  for i in 0..<W {
    let u = (Double(i) + 0.5) / Double(W), v = (Double(j) + 0.5) / Double(H)
    let w = g * u + h * v + 1
    let X = (A * u + B * v + C) / w - 0.5, Y = (D * u + E * v + F) / w - 0.5
    let xi = max(0, min(sw - 2, Int(floor(X)))), yi = max(0, min(sh - 2, Int(floor(Y))))
    let fx = max(0, min(1, X - Double(xi))), fy = max(0, min(1, Y - Double(yi)))
    for c in 0..<3 {
      func s(_ x: Int, _ y: Int) -> Double { Double(px[(y * sw + x) * 4 + c]) }
      let val = s(xi, yi) * (1 - fx) * (1 - fy) + s(xi + 1, yi) * fx * (1 - fy) + s(xi, yi + 1) * (1 - fx) * fy + s(xi + 1, yi + 1) * fx * fy
      out[(j * W + i) * 4 + c] = UInt8(max(0, min(255, val.rounded())))
    }
  }
}
out.withUnsafeMutableBytes { p in
  let ctx = CGContext(data: p.baseAddress, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(d, ctx.makeImage()!, [kCGImageDestinationLossyCompressionQuality: 0.86] as CFDictionary)
  CGImageDestinationFinalize(d)
}
print("wrote \(a[2]) \(W)x\(H)")
