// Turns full-size 360 panoramas into what the app loads (see tools/13-pano-hd.sh, which runs this):
//   public/pano/<name>.jpg                       2048 x 1024 preview, shown first
//   public/pano-hd/<name>/1/<row>_<col>.jpg      4096 x 2048 in 1024-pixel tiles (phones and small screens)
//   public/pano-hd/<name>/2/<row>_<col>.jpg      8192 x 4096 in 1024-pixel tiles (computers)
//   public/pano-hd/index.json                    which panoramas have tiles, and their sizes
// Each panorama is decoded once and halved step by step (12K -> 8K -> 4K -> 2K) with high-quality filtering, so
// every size stays sharp. Output is sRGB, which is what the browser's WebGL textures expect.
//
// Usage: swift tools/pano-tiles.swift <jobs.json> <public folder>
//   jobs.json: [{"src": "/path/Grand Living 02_12K.jpg", "name": "c4-d"}, ...]
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// JPEG quality (0-1 in Apple's scale, where 0.8 is already near-lossless): tiles, and the preview shown first
let env = ProcessInfo.processInfo.environment
let QUALITY = Double(env["PANO_Q"] ?? "") ?? 0.5
let PREVIEW_QUALITY = Double(env["PANO_PREVIEW_Q"] ?? "") ?? 0.45
let TILE = 1024
let LEVELS: [(level: String, width: Int)] = [("2", 8192), ("1", 4096)] // largest first: each is made from the one before
let PREVIEW = 2048
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!

struct Job: Decodable { let src: String; let name: String }

func load(_ path: String) -> CGImage? {
  guard let s = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil) else { return nil }
  return CGImageSourceCreateImageAtIndex(s, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary)
}
func resize(_ img: CGImage, _ w: Int, _ h: Int) -> CGImage? {
  guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: srgb,
                            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
  ctx.interpolationQuality = .high
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
  return ctx.makeImage()
}
// halve repeatedly, then a final step to the exact size
func shrink(_ img: CGImage, to w: Int) -> CGImage? {
  var cur = img
  while cur.width / 2 > w {
    guard let n = resize(cur, cur.width / 2, cur.height / 2) else { return nil }
    cur = n
  }
  return cur.width == w ? cur : resize(cur, w, w / 2)
}
func save(_ img: CGImage, _ path: String, _ q: Double = QUALITY) -> Bool {
  try? FileManager.default.createDirectory(atPath: (path as NSString).deletingLastPathComponent, withIntermediateDirectories: true)
  guard let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { return false }
  CGImageDestinationAddImage(d, img, [kCGImageDestinationLossyCompressionQuality: q] as CFDictionary)
  return CGImageDestinationFinalize(d)
}

let args = CommandLine.arguments
guard args.count >= 3, let data = FileManager.default.contents(atPath: args[1]),
      let jobs = try? JSONDecoder().decode([Job].self, from: data) else {
  print("usage: swift tools/pano-tiles.swift <jobs.json> <public folder>")
  exit(1)
}
let out = args[2]
var index: [String: [String: [Int]]] = [:]
let lock = NSLock()
var failed: [String] = []

// three at a time: each full-size panorama takes about 300 MB while it is being worked on
let queue = OperationQueue()
queue.maxConcurrentOperationCount = 3
for job in jobs {
  queue.addOperation {
    autoreleasepool {
      guard let full = load(job.src), full.width == full.height * 2 else {
        lock.lock(); failed.append(job.name + " (not a 2:1 panorama or unreadable)"); lock.unlock()
        return
      }
      var sizes: [String: [Int]] = [:]
      var cur: CGImage = full
      for (lv, want) in LEVELS {
        let w = min(want, full.width / TILE * TILE)
        guard let img = shrink(cur, to: w) else { continue }
        cur = img
        let cols = w / TILE, rows = (w / 2) / TILE
        for r in 0..<rows {
          for c in 0..<cols {
            if let t = img.cropping(to: CGRect(x: c * TILE, y: r * TILE, width: TILE, height: TILE)) {
              _ = save(t, "\(out)/pano-hd/\(job.name)/\(lv)/\(r)_\(c).jpg")
            }
          }
        }
        sizes[lv] = [w, w / 2, cols, rows]
      }
      if let p = shrink(cur, to: PREVIEW) { _ = save(p, "\(out)/pano/\(job.name).jpg", PREVIEW_QUALITY) }
      lock.lock(); index[job.name] = sizes; lock.unlock()
      print("\(job.name): done")
    }
  }
}
queue.waitUntilAllOperationsAreFinished()

// merge with the panoramas already listed, so they can be added a few at a time
let indexPath = "\(out)/pano-hd/index.json"
var all: [String: [String: [Int]]] = [:]
if let d = FileManager.default.contents(atPath: indexPath), let old = try? JSONDecoder().decode([String: [String: [Int]]].self, from: d) { all = old }
for (k, v) in index { all[k] = v }
let enc = JSONEncoder()
enc.outputFormatting = [.sortedKeys]
try? FileManager.default.createDirectory(atPath: "\(out)/pano-hd", withIntermediateDirectories: true)
try? enc.encode(all).write(to: URL(fileURLWithPath: indexPath))
print("\(all.count) panoramas listed in \(indexPath)")
if !failed.isEmpty { print("Skipped: " + failed.joined(separator: ", ")); exit(2) }
