#!/usr/bin/env python3
"""Draw Zerble's face as a QR code, for stickers and the cart sign, into print/.

    python3 scripts/build-qr.py

The code holds HTTPS://ZERBLE.NET. Capitals let the QR alphanumeric mode pack it into a
25x25 grid even at error correction H (the highest, where 30% of the code can be lost),
and both the scheme and the domain ignore case, so it opens the same page. The top two
finder patterns (the big corner squares scanners look for) are drawn as googly eyes, the
bottom-left one as a bubble, the modules as little ink bubbles, and the timeline cart's
fuzzy purple handlebar mustache (ported from assets/js/timeline-cart.js) sits in the
middle. The modules under the mustache are left out, and error correction H covers them.

Writes print/zerble-qr.svg (the bare code with its quiet zone) and
print/zerble-qr-card.svg (the code on a cream card under "Spotted Zerble?!?!", with a
#zerble wristband). The card's lettering is Titan One (scripts/fonts/, SIL OFL), turned
into outlines so a print shop doesn't need the font.

Needs segno and fonttools (pip3 install segno fonttools). When Google Chrome is
installed (or CHROME points at it), it also renders 2640px PNGs of both. When zxing-cpp
is installed (pip3 install zxing-cpp), it decodes each PNG and stops with an error if
one doesn't scan, so check the output on a few real phones either way before printing.
"""
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

import segno
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "print"
FONT = ROOT / "scripts" / "fonts" / "TitanOne-Regular.ttf"

DATA = "HTTPS://ZERBLE.NET"
QUIET = 4          # modules of blank margin a scanner needs around the code
PX = 10            # SVG pixels per module (the PNGs scale this up 8x)
PNG_SCALE = 8

# The site's palette (the top of assets/css/styles.css)
INK, CREAM, PINK, SUN = "#120c24", "#fff6e6", "#ff4fa3", "#ffd23f"

# The mustache: how many modules wide, and where its middle sits, in module coordinates.
# Error correction covers the modules it hides. At 16 modules wide a rotated scan starts
# failing and at 17.5 nothing decodes, so 13 leaves room for mud, scratches, and glare.
STACHE_W = 13
STACHE_CX, STACHE_CY = 12.5, 12.2
STACHE_CLEAR = 0.2   # extra blank space kept between the mustache and the bubbles

# The googly eyes look a touch toward the middle, like Zerble's do. Keep it small: the
# pupil is the finder pattern's dark core, and scanners need it near the center.
GAZE = (0.2, 0.18)


def f(n):
    """A number for the SVG, to 3 places, without trailing zeros."""
    s = f"{n:.3f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


# ---------- the mustache, ported from assets/js/timeline-cart.js ----------

def mulberry32(a):
    state = [a & 0xFFFFFFFF]

    def imul(x, y):
        return ((x & 0xFFFFFFFF) * (y & 0xFFFFFFFF)) & 0xFFFFFFFF

    def rnd():
        a = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
        state[0] = a
        t = imul(a ^ (a >> 15), 1 | a)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return rnd


def f1(n):
    return math.floor(n * 10 + 0.5) / 10


def smooth_segments(pts):
    """Closed Catmull-Rom spline through pts, as cubic Bezier segments."""
    n, segs = len(pts), []
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (f1(p1[0] + (p2[0] - p0[0]) / 6), f1(p1[1] + (p2[1] - p0[1]) / 6))
        c2 = (f1(p2[0] - (p3[0] - p1[0]) / 6), f1(p2[1] - (p3[1] - p1[1]) / 6))
        segs.append(((f1(p1[0]), f1(p1[1])), c1, c2, (f1(p2[0]), f1(p2[1]))))
    return segs


def smooth(pts):
    segs = smooth_segments(pts)
    d = "M" + f(segs[0][0][0]) + " " + f(segs[0][0][1])
    for _, c1, c2, e in segs:
        d += f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(e[0])} {f(e[1])}"
    return d + "Z"


def densify(pts, sub):
    """Open Catmull-Rom through [x, y, w] points, sub samples per span, w interpolated."""
    out, n = [], len(pts)
    for i in range(n - 1):
        p0, p1, p2, p3 = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(n - 1, i + 2)]
        for s in range(sub):
            u = s / sub
            u2, u3 = u * u, u * u * u
            q = [0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2
                        + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3) for k in (0, 1)]
            q.append(p1[2] + (p2[2] - p1[2]) * u)
            out.append(q)
    out.append(list(pts[-1]))
    return out


# The right half's centerline as [x, y, half-thickness], on the cart's 240-wide canvas
BAR = [[129, 150, 13], [136, 152, 18.5], [148, 154, 20.5], [162, 157, 17], [176, 159, 12.5], [189, 159, 9], [201, 155, 7],
       [210, 148, 5.8], [214, 140, 4.8], [212, 131, 4], [205, 126, 3.3], [198, 128, 2.7], [195, 134, 2.1], [198, 139, 1.5]]


def bar_outline(bar, thin, lift):
    c = densify(bar, 5)
    n, top, bot = len(c), [], []
    for i in range(n):
        a, b = c[max(0, i - 1)], c[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1
        nx, ny = dy / ln, -dx / ln
        w, cy = c[i][2] * thin, c[i][1] - lift * c[i][2]
        top.append([c[i][0] + nx * w, cy + ny * w])
        bot.append([c[i][0] - nx * w, cy - ny * w])

    def cap(e, p):
        ln = math.hypot(e[0] - p[0], e[1] - p[1]) or 1
        return [e[0] + (e[0] - p[0]) / ln * e[2] * thin, e[1] - lift * e[2] + (e[1] - p[1]) / ln * e[2] * thin]

    return top + [cap(c[-1], c[-2])] + bot[::-1] + [cap(c[0], c[1])]


def bezier(seg, t):
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = seg
    m = 1 - t
    return (m ** 3 * x0 + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t ** 3 * x3,
            m ** 3 * y0 + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t ** 3 * y3)


def outline_samples(pts, per=48):
    """Points along the smoothed outline, closely spaced, for measuring and for hit tests."""
    out = []
    for seg in smooth_segments(pts):
        out += [bezier(seg, i / per) for i in range(per)]
    return out


def fuzz(pts, seed, step, bump):
    """The browser version measures the path with getPointAtLength; this walks a dense
    polyline of the same spline, which lands within a fraction of a unit of it."""
    poly = outline_samples(pts)
    cum = [0.0]
    for i in range(1, len(poly) + 1):
        a, b = poly[i - 1], poly[i % len(poly)]
        cum.append(cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    total = cum[-1]

    def at(s):
        lo, hi = 0, len(cum) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if cum[mid] <= s:
                lo = mid
            else:
                hi = mid
        a, b = poly[lo % len(poly)], poly[(lo + 1) % len(poly)]
        t = (s - cum[lo]) / ((cum[lo + 1] - cum[lo]) or 1)
        return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

    n = round(total / step)
    rnd = mulberry32(seed)
    P = [at(i / n * total) for i in range(n)]

    def pt(p):
        return f(f1(p[0])) + " " + f(f1(p[1]))

    d = "M" + pt(P[0])
    for j in range(n):
        a, b = P[j], P[(j + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1
        nx, ny, k = dy / ln, -dx / ln, bump * (0.6 + rnd() * 0.8)
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        side = -1 if mx < 120 else 1
        tx, ty = mx + nx * k + side * k * 0.45, my + ny * k
        d += (f"Q{f(f1((a[0] + tx) / 2 + nx * k * 0.2))} {f(f1((a[1] + ty) / 2 + ny * k * 0.2))} {f(f1(tx))} {f(f1(ty))}"
              f"Q{f(f1((tx + b[0]) / 2 + nx * k * 0.15))} {f(f1((ty + b[1]) / 2 + ny * k * 0.15))} {pt(b)}")
    return d + "Z"


OUTLINE = bar_outline(BAR, 1, 0)
STACHE = fuzz(OUTLINE, 7, 6.5, 1.5)
STACHE_HI = smooth(bar_outline(BAR, 0.42, 0.35))
FUZZ_REACH = 1.5 * 1.4 * 1.45   # how far past the smooth outline a tuft can poke


def stache_shape():
    """Both halves of the smooth outline (the left is the right flipped about x=120),
    as polygons on the cart's canvas, plus their bounding box."""
    right = outline_samples(OUTLINE, 16)
    left = [(240 - x, y) for x, y in right]
    xs = [p[0] for p in right + left]
    ys = [p[1] for p in right + left]
    pad = FUZZ_REACH
    return [right, left], (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad)


def inside(poly, x, y):
    hit, n = False, len(poly)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def dist_to(poly, x, y):
    best, n = float("inf"), len(poly)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        dx, dy = x2 - x1, y2 - y1
        t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / ((dx * dx + dy * dy) or 1)))
        best = min(best, math.hypot(x - x1 - t * dx, y - y1 - t * dy))
    return best


# ---------- the code ----------

def build_matrix():
    qr = segno.make(DATA, error="h", boost_error=False, micro=False)
    rows = [list(r) for r in qr.matrix_iter(scale=1, border=0)]
    return qr, [[bool(v) for v in r] for r in rows]


def in_finder(r, c, n):
    return (r < 8 and c < 8) or (r < 8 and c >= n - 8) or (r >= n - 8 and c < 8)


def alignment_center(n):
    # Version 2 has one alignment pattern, centered 7 modules in from the bottom right.
    return (n - 7, n - 7) if n == 25 else None


def stache_placement():
    polys, (x0, y0, x1, y1) = stache_shape()
    s = STACHE_W / (x1 - x0)                    # canvas units -> modules
    tx = STACHE_CX - (x0 + x1) / 2 * s
    ty = STACHE_CY - (y0 + y1) / 2 * s
    return polys, s, tx, ty


def knocked_out(n):
    """Modules under the mustache (plus a little clearance), which get left out."""
    polys, s, tx, ty = stache_placement()
    reach = (0.5 + STACHE_CLEAR) / s + FUZZ_REACH
    out = set()
    for r in range(n):
        for c in range(n):
            if in_finder(r, c, n):
                continue
            x, y = (c + 0.5 - tx) / s, (r + 0.5 - ty) / s   # module center on the canvas
            if any(inside(p, x, y) or dist_to(p, x, y) < reach for p in polys):
                out.add((r, c))
    return out


DEFS = f"""<defs>
  <radialGradient id="zq-white" cx=".38" cy=".34" r=".78"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f6f1ff"/><stop offset="1" stop-color="#d9cff0"/></radialGradient>
  <radialGradient id="zq-iris" cx=".38" cy=".34" r=".8"><stop offset="0" stop-color="#2f6fd6"/><stop offset=".55" stop-color="#1762c4"/><stop offset="1" stop-color="#0d3a85"/></radialGradient>
  <linearGradient id="zq-stache" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b590ff"/><stop offset=".55" stop-color="#9b6bff"/><stop offset="1" stop-color="#7041d8"/></linearGradient>
  <linearGradient id="zq-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe3f1"/><stop offset=".35" stop-color="#fff6cf"/><stop offset=".65" stop-color="#dcf6ff"/><stop offset="1" stop-color="#ece2ff"/></linearGradient>
  <radialGradient id="zq-core" cx=".36" cy=".32" r=".8"><stop offset="0" stop-color="#3b2a6b"/><stop offset="1" stop-color="{INK}"/></radialGradient>
</defs>"""


def googly_eye(cx, cy):
    """A finder pattern as a googly eye: the ink rim is the dark ring, the white is the
    light ring, and the iris and pupil are the dark 3x3 core."""
    gx, gy = cx + GAZE[0] * (1 if cx < 12.5 else -1), cy + GAZE[1]
    return (f'<circle cx="{f(cx)}" cy="{f(cy)}" r="3.5" fill="{INK}"/>'
            f'<circle cx="{f(cx)}" cy="{f(cy)}" r="2.5" fill="url(#zq-white)"/>'
            f'<path d="M{f(cx - 1.75)} {f(cy - 0.9)}A2 2 0 0 1 {f(cx - 0.6)} {f(cy - 1.95)}" fill="none" stroke="#ffffff" stroke-width=".32" stroke-linecap="round"/>'
            f'<circle cx="{f(gx)}" cy="{f(gy)}" r="1.5" fill="url(#zq-iris)"/>'
            f'<circle cx="{f(gx)}" cy="{f(gy)}" r=".78" fill="{INK}"/>'
            f'<circle cx="{f(gx - 0.52)}" cy="{f(gy - 0.6)}" r=".26" fill="#ffffff"/>')


def bubble_finder(cx, cy):
    """The bottom-left finder as a bubble, with a smaller bubble floating in it. The small
    bubble's shine is a dot near its edge: an arc of light across it broke the dark core
    and made the code fail to decode."""
    return (f'<circle cx="{f(cx)}" cy="{f(cy)}" r="3.5" fill="{INK}"/>'
            f'<circle cx="{f(cx)}" cy="{f(cy)}" r="2.5" fill="url(#zq-sheen)"/>'
            f'<path d="M{f(cx - 1.8)} {f(cy + 0.7)}A1.95 1.95 0 0 1 {f(cx - 0.7)} {f(cy - 1.8)}" fill="none" stroke="#ffffff" stroke-width=".3" stroke-linecap="round"/>'
            f'<circle cx="{f(cx)}" cy="{f(cy)}" r="1.5" fill="url(#zq-core)"/>'
            f'<circle cx="{f(cx - 0.72)}" cy="{f(cy - 0.72)}" r=".22" fill="#ffffff" opacity=".9"/>')


def alignment_bubble(cx, cy):
    """The alignment pattern (a smaller target near the bottom right) as a ringed bubble."""
    return (f'<circle cx="{f(cx)}" cy="{f(cy)}" r="2.5" fill="{INK}"/>'
            f'<circle cx="{f(cx)}" cy="{f(cy)}" r="1.5" fill="url(#zq-sheen)"/>'
            f'<circle cx="{f(cx)}" cy="{f(cy)}" r=".55" fill="{INK}"/>'
            f'<circle cx="{f(cx - 0.62)}" cy="{f(cy - 0.62)}" r=".2" fill="#ffffff"/>')


def module_bubbles(matrix, skip, align):
    """Every other dark module as a little ink bubble with a glint. The glint sits off to
    the upper left, so the middle of each module, where scanners sample it, stays dark."""
    n = len(matrix)
    dots, glints = [], []
    for r in range(n):
        for c in range(n):
            if not matrix[r][c] or in_finder(r, c, n) or (r, c) in skip:
                continue
            if align and abs(r - align[0]) <= 2 and abs(c - align[1]) <= 2:
                continue
            x, y = c + 0.5, r + 0.5
            dots.append(f"M{f(x - 0.45)} {f(y)}a.45 .45 0 1 0 .9 0a.45 .45 0 1 0-.9 0")
            glints.append(f"M{f(x - 0.3)} {f(y - 0.17)}a.1 .1 0 1 0 .2 0a.1 .1 0 1 0-.2 0")
    return (f'<path d="{"".join(dots)}" fill="{INK}"/>'
            f'<path d="{"".join(glints)}" fill="{CREAM}" opacity=".85"/>')


def mustache():
    _, s, tx, ty = stache_placement()
    sw = 0.17 / s   # an ink outline about a sixth of a module wide

    def half(flip):
        t = ' transform="matrix(-1 0 0 1 240 0)"' if flip else ""
        return (f'<path d="{STACHE}" fill="url(#zq-stache)" stroke="{INK}" stroke-width="{f(sw)}" stroke-linejoin="round"{t}/>'
                f'<path d="{STACHE_HI}" fill="#c3a6ff" opacity=".7"{t}/>')

    return f'<g transform="translate({f(tx)} {f(ty)}) scale({f(s)})">{half(True)}{half(False)}</g>'


def code_group(matrix):
    """The whole face-code in module units, with (0, 0) at the top left of the grid."""
    n = len(matrix)
    align = alignment_center(n)
    skip = knocked_out(n)
    parts = [module_bubbles(matrix, skip, align),
             googly_eye(3.5, 3.5), googly_eye(n - 3.5, 3.5), bubble_finder(3.5, n - 3.5)]
    if align:
        parts.append(alignment_bubble(align[1] + 0.5, align[0] + 0.5))
    parts.append(mustache())
    return "".join(parts), skip


# ---------- lettering ----------

class Lettering:
    def __init__(self, path):
        self.font = TTFont(path)
        self.glyphs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.upem = self.font["head"].unitsPerEm
        self.hmtx = self.font["hmtx"]

    def width(self, text, size):
        return sum(self.hmtx[self.cmap[ord(ch)]][0] for ch in text) * size / self.upem

    def path(self, text, size, x, y):
        """Outlines for text at size, starting at x on the baseline y."""
        pen = SVGPathPen(self.glyphs, ntos=f)
        scale, adv = size / self.upem, 0
        for ch in text:
            name = self.cmap[ord(ch)]
            self.glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x + adv * scale, y)))
            adv += self.hmtx[name][0]
        return pen.getCommands()


# ---------- the two files ----------

def svg_doc(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{f(w * PX)}" height="{f(h * PX)}" viewBox="0 0 {f(w)} {f(h)}">'
            f"<title>{title}</title>{DEFS}{body}</svg>\n")


def bare_svg(group, n):
    size = n + 2 * QUIET
    body = (f'<rect width="{size}" height="{size}" fill="{CREAM}"/>'
            f'<g transform="translate({QUIET} {QUIET})">{group}</g>')
    return svg_doc(size, size, body, "Zerble QR code: HTTPS://ZERBLE.NET"), size


def card_svg(group, n, letters):
    code = n + 2 * QUIET                    # the code with its quiet zone
    side = 2.2                              # card margin beside the quiet zone
    w = code + 2 * side
    title, title_size = "Spotted Zerble?!?!", 3.5
    while letters.width(title, title_size) > w - 7:
        title_size -= 0.05
    # The title and the wristband both stay outside the quiet zone, so the code keeps its
    # full 4 modules of blank margin on every side.
    top = 5.2                               # room above the quiet zone for the title
    chip_text, chip_size = "#zerble", 2.6
    chip_w, chip_h = letters.width(chip_text, chip_size) + 3.2, 4.1
    bottom = chip_h + 2.4                   # room below the quiet zone for the wristband
    h = top + code + bottom
    tw = letters.width(title, title_size)
    tx, ty = (w - tw) / 2, top - 0.7        # the title's baseline, just above the quiet zone
    cx, cy = w / 2, top + code + 0.4 + chip_h / 2
    body = (
        f'<rect x=".25" y=".25" width="{f(w - 0.5)}" height="{f(h - 0.5)}" rx="2.6" fill="{CREAM}" stroke="{INK}" stroke-width=".5"/>'
        f'<path d="{letters.path(title, title_size, tx, ty + 0.38)}" fill="{INK}"/>'
        f'<path d="{letters.path(title, title_size, tx, ty)}" fill="{PINK}"/>'
        f'<g transform="translate({f(side + QUIET)} {f(top + QUIET)})">{group}</g>'
        f'<g transform="rotate(-2 {f(cx)} {f(cy)})">'
        f'<rect x="{f(cx - chip_w / 2)}" y="{f(cy - chip_h / 2 + 0.36)}" width="{f(chip_w)}" height="{f(chip_h)}" rx=".7" fill="{INK}"/>'
        f'<rect x="{f(cx - chip_w / 2)}" y="{f(cy - chip_h / 2)}" width="{f(chip_w)}" height="{f(chip_h)}" rx=".7" fill="{SUN}" stroke="{INK}" stroke-width=".3"/>'
        f'<path d="{letters.path(chip_text, chip_size, cx - letters.width(chip_text, chip_size) / 2, cy + chip_size * 0.36)}" fill="{INK}"/>'
        f"</g>"
    )
    return svg_doc(w, h, body, "Spotted Zerble?!?! A QR code for HTTPS://ZERBLE.NET, with #zerble"), (w, h)


def find_chrome():
    for c in (os.environ.get("CHROME"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              shutil.which("google-chrome"), shutil.which("chromium")):
        if c and Path(c).exists():
            return c
    return None


def render_png(chrome, svg_path, png_path, w, h):
    """Headless Chrome draws the SVG at PNG_SCALE times its size, with a clear background."""
    subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=2000",
                    f"--window-size={math.ceil(w * PX)},{math.ceil(h * PX)}", f"--force-device-scale-factor={PNG_SCALE}",
                    "--default-background-color=00000000", f"--screenshot={png_path}", svg_path.as_uri()],
                   check=True, capture_output=True, timeout=90)


def check(png_path):
    try:
        import zxingcpp
        from PIL import Image
    except ImportError:
        print(f"  (zxing-cpp isn't installed, so {png_path.name} wasn't decoded)")
        return
    img = Image.open(png_path).convert("RGBA")
    flat = Image.new("RGB", img.size, "white")
    flat.paste(img, mask=img.split()[3])
    for width in (flat.width, 600, 240):   # full size, then about phone-camera sizes
        small = flat.resize((width, round(flat.height * width / flat.width)), Image.LANCZOS)
        got = [r.text for r in zxingcpp.read_barcodes(small)]
        if DATA not in got:
            sys.exit(f"{png_path.name} didn't decode at {width}px wide (got {got})")
    print(f"  {png_path.name} decodes as {DATA} at full size, 600px, and 240px")


def main():
    qr, matrix = build_matrix()
    n = len(matrix)
    group, skip = code_group(matrix)
    letters = Lettering(FONT)
    OUT.mkdir(exist_ok=True)

    bare, size = bare_svg(group, n)
    card, (cw, ch) = card_svg(group, n, letters)
    files = [("zerble-qr", bare, size, size), ("zerble-qr-card", card, cw, ch)]
    print(f"{DATA}: version {qr.version}, {n}x{n}, error correction {qr.error}, mask {qr.mask}, "
          f"{len(skip)} modules under the mustache")

    chrome = find_chrome()
    for name, svg, w, h in files:
        svg_path = OUT / f"{name}.svg"
        svg_path.write_text(svg)
        print(f"{svg_path.relative_to(ROOT)}")
        if chrome:
            png_path = OUT / f"{name}.png"
            render_png(chrome, svg_path, png_path, w, h)
            print(f"{png_path.relative_to(ROOT)}")
            check(png_path)
    if not chrome:
        print("(no Chrome found, so no PNGs; set CHROME to its path)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
