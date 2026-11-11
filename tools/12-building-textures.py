# Textures for the building view and the amenity floors, named after the specs-book finishes where one exists.
import numpy as np, cv2, os
from scipy.ndimage import gaussian_filter, map_coordinates
OUT = 'public/tex/'
os.makedirs(OUT, exist_ok=True)
def tn(n, cx, cy, seed):
    r = np.random.default_rng(seed); g = r.random((cy, cx)).astype(np.float32); g = np.tile(g, (3, 3))
    return cv2.resize(g, (n * 3, n * 3), interpolation=cv2.INTER_CUBIC)[n:2 * n, n:2 * n]
def fbm(n, cx, cy, oct, seed, gain=0.5):
    s = np.zeros((n, n), np.float32); a = 1; t = 0
    for o in range(oct):
        x = cx * 2 ** o; y = cy * 2 ** o
        if x > n / 2 or y > n / 2: break
        s += a * tn(n, x, y, seed * 17 + o); t += a; a *= gain
    s /= t; return (s - s.min()) / (s.max() - s.min() + 1e-6)
def nmap(h, s):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5; gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nx = -gx * s; ny = gy * s; nz = np.ones_like(nx); l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return (np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5) * 255
def mix(c1, c2, t): t = np.clip(t, 0, 1)[..., None]; return np.array(c1, np.float32) * (1 - t) + np.array(c2, np.float32) * t
def save(name, img, q=86):
    img = np.clip(img, 0, 255).astype(np.uint8)
    cv2.imwrite(OUT + name + '.jpg', img[:, :, ::-1] if img.ndim == 3 else img, [cv2.IMWRITE_JPEG_QUALITY, q])
N = 1024
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32) / N

# ST-503 Silver Wave: dark grey with fine white wavy bands (spa floor; also the dark wavy stone of the podium pilasters)
def wave_stone(name, base, line, seed, freq=22, amp=0.035, rough=0.5, tile=None):
    w = fbm(N, 3, 2, 6, seed) - 0.5; w2 = fbm(N, 8, 4, 4, seed + 1) - 0.5
    ph = 2 * np.pi * (yy * freq + amp * 30 * w + 0.25 * w2)
    band = np.power(np.abs(np.sin(ph)), 18)
    fine = np.power(np.abs(np.sin(ph * 3.1 + 2)), 30) * 0.5
    cl = fbm(N, 4, 4, 5, seed + 2)
    col = np.array(base, np.float32)[None, None] * (0.85 + 0.3 * cl[..., None])
    col = mix(col, line, np.clip(band * 0.85 + fine * 0.5, 0, 1) * (0.5 + 0.6 * fbm(N, 6, 3, 3, seed + 3)))
    if tile:  # panel joints
        tw, th = tile
        fx = (xx * tw) % 1; fy = (yy * th) % 1
        j = np.clip(np.minimum(np.minimum(fx, 1 - fx) * N / tw, np.minimum(fy, 1 - fy) * N / th) / 2.0, 0, 1)
        col = col * (0.55 + 0.45 * j[..., None])
    save(name, col)
    save(name + '_r', np.stack([np.clip(rough + 0.1 * cl - 0.2 * band, 0, 1) * 255] * 3, -1))
wave_stone('stone_silverwave', (82, 83, 86), (215, 215, 212), 3)
wave_stone('stone_wavepanel', (92, 92, 94), (196, 196, 192), 7, freq=16, tile=(2, 2))

# ST-500 Moca fine-grain limestone 600x1200 (general floor) and ST-501 Moleanos bushhammered (GF walls)
def limestone(name, base, tile, seed, grain=0.06, joint=(200, 194, 184), bush=False):
    cl = fbm(N, 4, 4, 6, seed); sp = fbm(N, 128, 128, 2, seed + 1)
    col = np.array(base, np.float32)[None, None] * (1 - grain + 2 * grain * cl[..., None]) * (0.97 + 0.06 * sp[..., None])
    h = sp.copy()
    if bush:
        pits = (fbm(N, 256, 256, 2, seed + 2) < 0.25).astype(np.float32)
        col *= (1 - 0.12 * gaussian_filter(pits, 0.8, mode='wrap'))[..., None]; h = h - pits
    tw, th = tile
    fx = (xx * tw) % 1; fy = (yy * th) % 1
    j = np.clip(np.minimum(np.minimum(fx, 1 - fx) * N / tw, np.minimum(fy, 1 - fy) * N / th) / 1.5, 0, 1)
    col = col * j[..., None] + np.array(joint, np.float32) * (1 - j[..., None])
    save(name, col); save(name + '_n', nmap(gaussian_filter(h * 0.6 + j, 0.6, mode='wrap'), 2.0))
limestone('stone_moca', (209, 202, 192), (2, 1), 11)
limestone('stone_moleanos', (219, 211, 203), (2, 3), 12, bush=True, joint=(190, 182, 172))

# TL-501 Garbino and TL-502 Tannis 15 mm glass mosaic (steam room, spa pool)
def mosaic(name, cols, seed, cells=64):
    r = np.random.default_rng(seed)
    idx = r.integers(0, len(cols), (cells, cells))
    pal = np.array(cols, np.float32)
    small = pal[idx] * (0.85 + 0.3 * r.random((cells, cells, 1)))
    big = cv2.resize(small, (N, N), interpolation=cv2.INTER_NEAREST)
    f = (xx * cells) % 1; g = (yy * cells) % 1
    j = np.clip(np.minimum(np.minimum(f, 1 - f), np.minimum(g, 1 - g)) * 9, 0, 1)
    grout = np.array((60, 62, 64), np.float32)
    col = big * j[..., None] + grout * (1 - j[..., None])
    save(name, col); save(name + '_n', nmap(j * 1.0, 3.0))
mosaic('mosaic_garbino', [(70, 74, 76), (52, 55, 57), (95, 99, 101), (38, 40, 42)], 21)
mosaic('mosaic_tannis', [(118, 128, 138), (100, 110, 120), (140, 150, 158), (86, 96, 106)], 22)

# RV-500 rubber gym floor, black basket weave
rb = np.abs(np.sin(2 * np.pi * xx * 40)) * (np.sin(2 * np.pi * yy * 20) > 0) + np.abs(np.sin(2 * np.pi * yy * 40)) * (np.sin(2 * np.pi * xx * 20) <= 0)
col = np.stack([28 + 14 * rb + 8 * fbm(N, 64, 64, 2, 31)] * 3, -1)
save('rubber_weave', col); save('rubber_weave_n', nmap(gaussian_filter(rb, 1, mode='wrap'), 2.5))

# CP-500 carpet tile, brown-grey fine vertical stripe, 500 mm tiles quarter-turned
st = np.sin(2 * np.pi * xx * 90) * 0.5 + 0.5
st2 = np.sin(2 * np.pi * yy * 90) * 0.5 + 0.5
q = ((np.floor(xx * 4) + np.floor(yy * 4)) % 2).astype(np.float32)
s = st * q + st2 * (1 - q)
col = mix((122, 112, 100), (98, 90, 80), s * 0.7 + 0.3 * fbm(N, 128, 128, 2, 41))
save('carpet_tile', col); save('carpet_tile_n', nmap(s * 0.6 + fbm(N, 256, 256, 2, 42), 1.5))

# lawn
g = fbm(N, 64, 64, 3, 51); g2 = fbm(N, 256, 256, 2, 52)
col = mix((62, 104, 46), (112, 150, 70), g * 0.6 + g2 * 0.4)
save('grass', col); save('grass_n', nmap(g2 * 2, 3))

# pool water normal (ripples) and pool deck paving: grey-green stone with marble bands (from the deck renders)
w = fbm(N, 8, 8, 5, 61)
save('water_n', nmap(w * 3, 3))
fy = (yy * 6) % 1
band = (np.abs(fy - 0.5) < 0.04).astype(np.float32)
cl = fbm(N, 6, 6, 5, 62)
tiles = ((np.floor(xx * 3) + np.floor(yy * 6)) % 3) / 3
col = mix((132, 146, 138), (112, 126, 120), cl * 0.6 + tiles * 0.3)
col = mix(col, (205, 207, 206), band * (0.6 + 0.4 * fbm(N, 16, 4, 3, 63)))
fx = (xx * 3) % 1
jt = np.clip(np.minimum(np.minimum(fx, 1 - fx) * N / 3, np.minimum(fy, 1 - fy) * N / 6) / 1.4, 0, 1)
col = col * (0.75 + 0.25 * jt[..., None])
save('deck_paving', col); save('deck_paving_n', nmap(jt + 0.3 * cl, 2))

# WD-503 custom bamboo panel (lift lobby): grey-green with an inlaid short-dash pattern
base = mix((134, 131, 120), (118, 116, 106), fbm(N, 4, 32, 4, 71))
dash = ((np.sin(2 * np.pi * yy * 48) > 0.85) & (((xx * 24 + np.floor(yy * 48) * 0.5) % 1) < 0.5)).astype(np.float32)
col = mix(base, (176, 170, 150), dash * 0.7)
save('bamboo_panel', col)

# podium bronze fin and facade glass interior (warm, blurred room seen through glass)
br = fbm(N, 4, 64, 4, 81)
save('bronze_brushed', mix((120, 96, 62), (170, 136, 88), br))
# night interior glow card
glow = gaussian_filter(np.random.default_rng(91).random((64, 64)).astype(np.float32), 3)
glow = cv2.resize(glow, (256, 256)); glow = (glow - glow.min()) / (glow.max() - glow.min())
save('interior_glow', mix((70, 52, 36), (255, 214, 160), glow))
print('ok', len(os.listdir(OUT)))
