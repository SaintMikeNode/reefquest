"""Paints the home page hero: an over/under-water view of a Bay Island and its reef.

Original procedural artwork (no source images): layered noise for a painted sky, an island on the
horizon, the waterline, light rays and a stylized Caribbean reef (branching corals, sea fans, brain
mounds, tube sponges), finished with a median filter and brush grain for a gouache look.

Output: public/img/hero-reef.webp (2400 px) and hero-reef-1200.webp.
Usage:  ~/.venvs/reefquest/bin/python scripts/hero_art.py [--preview path.jpg]
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

W, H = 2400, 1500
ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)


def hexc(s: str) -> np.ndarray:
    s = s.lstrip("#")
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def vnoise(h, w, cy, cx, seed):
    """Smooth value noise in [0, 1] with cells of cy × cx pixels."""
    r = np.random.default_rng(seed)
    g = r.random((int(math.ceil(h / cy)) + 3, int(math.ceil(w / cx)) + 3)).astype(np.float32)
    z = ndimage.zoom(g, (cy, cx), order=3)
    oy, ox = int(cy * 0.7), int(cx * 0.7)
    return np.clip(z[oy:oy + h, ox:ox + w], 0, 1)


def fbm(h, w, cy, cx, seed, octaves=5):
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * vnoise(h, w, max(2, cy / 2 ** o), max(2, cx / 2 ** o), seed + o * 17)
        tot += amp
        amp *= 0.5
    return out / tot


def noise1d(w, cell, seed):
    return vnoise(1, w, 1, cell, seed)[0]


def ramp(t, stops):
    """Color ramp: stops = [(pos, hex), ...]; t is an array in [0, 1]."""
    out = np.zeros(t.shape + (3,), np.float32)
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        k = np.clip((t - p0) / (p1 - p0), 0, 1)[..., None]
        m = ((t >= p0) & (t <= p1))[..., None]
        out = np.where(m, hexc(c0) * (1 - k) + hexc(c1) * k, out)
    out = np.where((t < stops[0][0])[..., None], hexc(stops[0][1]), out)
    return np.where((t > stops[-1][0])[..., None], hexc(stops[-1][1]), out)


def over(img, color, alpha):
    a = alpha[..., None]
    return img * (1 - a) + color * a


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
YH = 0.585 * H  # horizon
wl = 0.672 * H + 13 * np.sin(np.arange(W) / 250 + 1.0) + 7 * np.sin(np.arange(W) / 93) + 10 * (noise1d(W, 180, 3) - 0.5)
WL = wl[None, :]  # waterline (the lens is half under water)

# ---------------- Sky ----------------
img = ramp(yy / YH, [(0, "#1560bd"), (0.4, "#1b86c4"), (0.75, "#2fb0b6"), (1, "#8fdcc2")])

# Clouds: big cumulus masses lit from the upper left, in four painted tones.
n = 0.72 * fbm(H, W, 330, 560, 11, 5) + 0.28 * fbm(H, W, 90, 120, 41, 3)
cover = 0.535 + 0.05 * (yy / YH) - 0.09 * smooth(0.25, 0.0, xx / W) - 0.08 * smooth(0.7, 1.0, xx / W)
# Keep the middle of the sky calmer where the headline sits.
cover += 0.1 * np.exp(-(((xx - W * 0.5) / (W * 0.26)) ** 2 + ((yy - H * 0.27) / (H * 0.2)) ** 2))
thick = smooth(0.0, 0.2, n - cover)
alpha = smooth(0.0, 0.035, n - cover)
shift = ndimage.shift(thick, (46, 46), order=1, mode="nearest")
lit = np.clip(0.55 + 2.4 * (thick - shift) + 0.25 * thick, 0, 1)
lit = np.floor(lit * 5) / 4.0  # posterize: flat painted tones
lit = ndimage.gaussian_filter(lit, 2.2)
# Mid-tone clouds (white type must read over them): blue shadows, pink and peach lights.
cloud = ramp(lit, [(0, "#4b79c6"), (0.3, "#8f8fd0"), (0.55, "#e08fa8"), (0.8, "#f4b39c"), (1, "#fbd9b8")])
pink = fbm(H, W, 500, 800, 77, 2)[..., None]  # some masses pinker, some more golden
cloud = cloud * (1 - 0.25 * pink) + hexc("#ec9bb5") * 0.25 * pink
img = over(img, cloud, alpha * (yy < YH + 4))
# Haze near the horizon.
img = over(img, hexc("#a8e6d2"), 0.35 * smooth(0.82, 1.0, yy / YH) * (yy < YH))

# ---------------- Island ----------------
xs = np.arange(W, dtype=np.float32)


def ridge(x0, x1, base, var, cell, seed):
    env = smooth(x0, x0 + 0.13, xs / W) * smooth(x1, x1 - 0.16, xs / W)
    return env * (base + var * noise1d(W, cell, seed) + 0.35 * var * noise1d(W, cell / 4, seed + 5))


far = YH - ridge(0.02, 0.78, 26, 62, 300, 21)[None, :]
img = over(img, hexc("#4fa3a8"), ((yy > far) & (yy <= YH)).astype(np.float32) * 0.9)
near_h = ridge(0.2, 0.99, 34, 120, 260, 33)
near = YH - near_h[None, :]
inside = ((yy > near) & (yy <= YH)).astype(np.float32)
tone = np.clip((YH - yy) / (near_h[None, :] + 1e-3), 0, 1)  # 0 at the shore, 1 at the crest
tex = np.floor((0.6 * tone + 0.4 * fbm(H, W, 26, 44, 55, 3)) * 4) / 4
land = ramp(tex, [(0, "#1d6b62"), (0.4, "#2f8a66"), (0.75, "#5fb173"), (1, "#a9d98a")])
img = over(img, land, inside)
beach = ((yy > YH - 7) & (yy <= YH) & (near_h[None, :] > 6)).astype(np.float32)
img = over(img, hexc("#f6e7bf"), beach)

# ---------------- Sea surface (from the horizon to the waterline) ----------------
sea_t = np.clip((yy - YH) / (WL - YH), 0, 1)
sea = ramp(sea_t, [(0, "#3fc7c4"), (0.5, "#27b2cb"), (1, "#1a9fd0")])
glints = (vnoise(H, W, 5, 90, 71) > 0.78).astype(np.float32) * (0.5 - 0.3 * sea_t)
sea = over(sea, hexc("#d9fbf3"), glints)
img = np.where(((yy > YH) & (yy <= WL))[..., None], sea, img)

# ---------------- Underwater ----------------
depth = np.clip((yy - WL) / (H - WL), 0, 1)
water = ramp(depth, [(0, "#52d9cf"), (0.12, "#2bbfd0"), (0.5, "#1489d6"), (1, "#0b55c8")])
rays = noise1d(W * 2, 75, 91)
ray_idx = np.clip((xx + (yy - WL) * 0.42).astype(np.int32), 0, W * 2 - 1)
ray = smooth(0.52, 0.85, rays[ray_idx]) * np.exp(-depth * 2.3) * 0.5
water = over(water, hexc("#c9fff2"), ray)
under = (yy > WL)[..., None]
img = np.where(under, water, img)


# ---------------- Reef (drawn at 2× and downsampled) ----------------
S = 2
lay_back = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
lay_front = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
r2 = np.random.default_rng(19)


def bumps(base, amp, cell, seed, left=0.0, right=0.0):
    f = base - amp * noise1d(W, cell, seed)
    f -= left * H * np.exp(-((xs / W - 0.07) / 0.13) ** 2) + right * H * np.exp(-((xs / W - 0.93) / 0.15) ** 2)
    return f


floor_back = bumps(0.85 * H, 70, 330, 61, 0.04, 0.06)
floor_front = bumps(0.95 * H, 60, 260, 62, 0.11, 0.13)


def rgba(h, a=255):
    c = (hexc(h) * 255).astype(int)
    return (int(c[0]), int(c[1]), int(c[2]), a)


def lighten(h, k):
    c = hexc(h)
    c = c + (1 - c) * k if k > 0 else c * (1 + k)
    return "#%02x%02x%02x" % tuple(int(v * 255) for v in np.clip(c, 0, 1))


def ground(layer, floor, top, bottom, rim, seed):
    """Reef rock: lighter at its crest, darker below, mottled, with a rim of light along the top."""
    f = floor[None, :]
    t = np.clip((yy - f) / (H - f + 1e-3), 0, 1)
    tex = np.floor((0.75 * t + 0.25 * fbm(H, W, 30, 70, seed, 3)) * 6) / 6
    col = hexc(top) * (1 - tex[..., None]) + hexc(bottom) * tex[..., None]
    col = over(col, hexc(rim), smooth(14, 0, yy - f) * 0.8)
    a = (yy >= f).astype(np.float32)
    arr = np.dstack([col, a])
    g = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "RGBA").resize((W * S, H * S), Image.BILINEAR)
    layer.alpha_composite(g)


def branch(d, x, y, ang, length, width, color, depth):
    x2, y2 = x + math.cos(ang) * length, y - math.sin(ang) * length
    d.line([(x, y), (x2, y2)], fill=rgba(color), width=max(2, int(width)))
    d.ellipse([x2 - width / 2, y2 - width / 2, x2 + width / 2, y2 + width / 2], fill=rgba(lighten(color, 0.25 if depth == 0 else 0)))
    if depth == 0:
        return
    for k in range(2 if depth < 3 else 3):
        spread = (k - (0.5 if depth < 3 else 1)) * r2.uniform(0.55, 0.9) + r2.uniform(-0.15, 0.15)
        branch(d, x2, y2, ang + spread, length * r2.uniform(0.62, 0.8), width * 0.72, lighten(color, 0.07), depth - 1)


def coral_branch(layer, x, y, size, color):
    d = ImageDraw.Draw(layer)
    branch(d, x * S, y * S, math.pi / 2 + r2.uniform(-0.2, 0.2), size * S * 0.42, size * S * 0.12, color, 3)


def coral_fan(layer, x, y, size, color):
    d = ImageDraw.Draw(layer)
    cx, cy, R = x * S, y * S, size * S
    a0, a1 = math.radians(r2.uniform(200, 215)), math.radians(r2.uniform(325, 340))
    pts = [(cx, cy)]
    for i in range(25):
        a = a0 + (a1 - a0) * i / 24
        rr = R * (0.9 + 0.1 * math.sin(i * 1.7) + 0.06 * r2.uniform(-1, 1))
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    d.polygon(pts, fill=rgba(color))
    for i in range(9):  # veins
        a = a0 + (a1 - a0) * (i + 0.5) / 9
        d.line([(cx, cy), (cx + math.cos(a) * R * 0.92, cy + math.sin(a) * R * 0.92)], fill=rgba(lighten(color, 0.28)), width=max(2, int(R * 0.022)))
    for k in (0.4, 0.62, 0.82):
        d.arc([cx - R * k, cy - R * k, cx + R * k, cy + R * k], math.degrees(a0), math.degrees(a1), fill=rgba(lighten(color, -0.2)), width=max(2, int(R * 0.014)))
    d.line([(cx, cy), (cx, cy + R * 0.22)], fill=rgba(lighten(color, -0.25)), width=max(3, int(R * 0.05)))


def coral_brain(layer, x, y, size, color):
    d = ImageDraw.Draw(layer)
    cx, cy, R = x * S, y * S, size * S
    d.pieslice([cx - R, cy - R * 0.78, cx + R, cy + R * 0.78], 180, 360, fill=rgba(color))
    d.pieslice([cx - R * 0.8, cy - R * 0.7, cx + R * 0.45, cy + R * 0.5], 190, 330, fill=rgba(lighten(color, 0.16)))
    for k in range(5):  # meandering grooves
        rr = R * (0.25 + 0.15 * k)
        d.arc([cx - rr, cy - rr * 0.78, cx + rr, cy + rr * 0.78], 195 + 9 * k, 345 - 7 * k, fill=rgba(lighten(color, -0.22)), width=max(2, int(R * 0.035)))


def coral_tubes(layer, x, y, size, color):
    d = ImageDraw.Draw(layer)
    for k in range(int(r2.integers(3, 6))):
        w = size * S * r2.uniform(0.16, 0.24)
        h = size * S * r2.uniform(0.6, 1.25)
        px = x * S + (k - 2) * w * 1.15 + r2.uniform(-4, 4)
        d.rounded_rectangle([px - w / 2, y * S - h, px + w / 2, y * S + 8], radius=w / 2, fill=rgba(lighten(color, 0.1 * (k % 2))))
        d.ellipse([px - w * 0.36, y * S - h + w * 0.08, px + w * 0.36, y * S - h + w * 0.5], fill=rgba(lighten(color, -0.35)))
        d.line([(px - w * 0.3, y * S - h * 0.9), (px - w * 0.3, y * S - 6)], fill=rgba(lighten(color, 0.3)), width=max(2, int(w * 0.12)))


def grass(layer, x, y, size, color):
    d = ImageDraw.Draw(layer)
    for k in range(9):
        lean = r2.uniform(-0.5, 0.5)
        h = size * S * r2.uniform(0.6, 1.1)
        px = x * S + r2.uniform(-size, size) * S * 0.4
        pts = [(px + lean * h * (t / 6) ** 2, y * S - h * t / 6) for t in range(7)]
        d.line(pts, fill=rgba(lighten(color, r2.uniform(-0.1, 0.2))), width=max(3, int(size * S * 0.05)), joint="curve")


PAL = {
    "branch": ["#ff8a6e", "#ffb46a", "#ff9fb4", "#ffd27a"],
    "fan": ["#b56be6", "#d77be0", "#8f6df0"],
    "brain": ["#e9b45a", "#d99a52", "#c7c36a"],
    "tubes": ["#f2c037", "#a66cf0", "#ff7f50"],
    "grass": ["#57c08a", "#3fae84"],
}
DRAW = {"branch": coral_branch, "fan": coral_fan, "brain": coral_brain, "tubes": coral_tubes, "grass": grass}


def populate(layer, floor, count, size0, size1, haze, weights):
    kinds = list(weights)
    p = np.array([weights[k] for k in kinds], float)
    p /= p.sum()
    spots = sorted(r2.uniform(0.01, 0.99, count))
    for u in spots:
        x = u * W
        # Fewer and smaller in the middle, where the data cards overlap the artwork.
        mid = math.exp(-((u - 0.5) / 0.2) ** 2)
        if r2.random() < 0.45 * mid:
            continue
        kind = kinds[int(r2.choice(len(kinds), p=p))]
        size = r2.uniform(size0, size1) * (1 - 0.3 * mid)
        # Nothing pokes through the surface.
        size = min(size, (float(floor[int(x)]) - float(wl[int(x)]) - 16) / (1.3 if kind in ("tubes", "branch") else 1.0))
        if size < 14:
            continue
        col = PAL[kind][int(r2.integers(len(PAL[kind])))]
        if haze:  # distance: fade toward the water color
            c = hexc(col) * (1 - haze) + hexc("#1c86d6") * haze
            col = "#%02x%02x%02x" % tuple(int(v * 255) for v in c)
        DRAW[kind](layer, x, float(floor[int(x)]) + 6, size, col)


ground(lay_back, floor_back, "#3d9be0", "#1c6fcc", "#7fd0f0", 401)
populate(lay_back, floor_back, 70, 40, 90, 0.5, {"branch": 3, "fan": 3, "brain": 3, "tubes": 2, "grass": 2})
ground(lay_front, floor_front, "#2463c9", "#0d3c9c", "#62b4f2", 402)
populate(lay_front, floor_front, 74, 70, 170, 0.0, {"branch": 4, "fan": 3, "brain": 3, "tubes": 3, "grass": 2})


def composite(img, layer):
    a = np.asarray(layer.resize((W, H), Image.LANCZOS), np.float32) / 255
    return over(img, a[..., :3], a[..., 3])


img = composite(img, lay_back)
# A veil of water between the two reef layers.
img = over(img, hexc("#1489d6"), 0.18 * (yy > WL))
img = composite(img, lay_front)

# Fish: two small schools.
fish = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
fd = ImageDraw.Draw(fish)
for cx, cy, col, n_f, sz in [(0.3, 0.775, "#ffd23f", 13, 17), (0.72, 0.76, "#eaf6ff", 11, 15), (0.55, 0.8, "#ffb347", 7, 14)]:
    for _ in range(n_f):
        x, y = (cx * W + r2.normal(0, 70)) * S, (cy * H + r2.normal(0, 26)) * S
        s = sz * S * r2.uniform(0.7, 1.2)
        fd.ellipse([x - s, y - s * 0.45, x + s, y + s * 0.45], fill=rgba(col))
        fd.polygon([(x - s * 0.8, y), (x - s * 1.7, y - s * 0.5), (x - s * 1.7, y + s * 0.5)], fill=rgba(col))
img = composite(img, fish)

# Waterline: a bright meniscus with a darker lip under it.
img = over(img, hexc("#0d6fc0"), 0.5 * smooth(9, 0, np.abs(yy - WL - 7)))
img = over(img, hexc("#f2fffb"), smooth(5, 0, np.abs(yy - WL)))

# ---------------- Painterly finish ----------------
out = np.clip(img, 0, 1)
for c in range(3):  # flatten into brush-like patches
    out[..., c] = ndimage.median_filter(out[..., c], size=7)
grain = 1 + 0.035 * (vnoise(H, W, 3, 14, 301) - 0.5) + 0.03 * (vnoise(H, W, 40, 60, 302) - 0.5)
out = np.clip(out * grain[..., None], 0, 1)
im = Image.fromarray((out * 255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(radius=2, percent=40))

if "--preview" in sys.argv:
    im.resize((1200, 750), Image.LANCZOS).save(sys.argv[sys.argv.index("--preview") + 1], quality=88)
else:
    dest = ROOT / "public" / "img"
    dest.mkdir(parents=True, exist_ok=True)
    im.save(dest / "hero-reef.webp", quality=82, method=6)
    im.resize((1200, 750), Image.LANCZOS).save(dest / "hero-reef-1200.webp", quality=80, method=6)
    for f in ("hero-reef.webp", "hero-reef-1200.webp"):
        print(f, round((dest / f).stat().st_size / 1024), "KB")
