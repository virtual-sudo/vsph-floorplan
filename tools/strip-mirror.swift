// A long, seam-free strip from one crop of a photo: the crop, then its mirror image, then the crop again, and so on.
// For stone that must not visibly tile, such as a book-matched marble splashback: neighbouring copies meet at a
// mirror line, so the veins run on across every join (the way real slabs are book-matched).
// Usage: strip-mirror <in> <out.jpg> <x> <y> <w> <h> <copies>
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count == 8, let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil),
      let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("usage: strip-mirror in out x y w h copies"); exit(1) }
let x = Int(a[3])!, y = Int(a[4])!, w = Int(a[5])!, h = Int(a[6])!, n = Int(a[7])!
let crop = img.cropping(to: CGRect(x: x, y: y, width: w, height: h))!
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: w * n, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.interpolationQuality = .high
for i in 0..<n {
  ctx.saveGState()
  if i % 2 == 1 { ctx.translateBy(x: CGFloat((i + 1) * w), y: 0); ctx.scaleBy(x: -1, y: 1) } else { ctx.translateBy(x: CGFloat(i * w), y: 0) }
  ctx.draw(crop, in: CGRect(x: 0, y: 0, width: w, height: h))
  ctx.restoreGState()
}
let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(d, ctx.makeImage()!, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
CGImageDestinationFinalize(d)
print("wrote \(a[2]) \(w * n)x\(h)")
