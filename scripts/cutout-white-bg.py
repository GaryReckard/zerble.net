#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "scipy"]
# ///
"""Cut the flat white background out of AI sticker art, at full resolution.

    uv run scripts/cutout-white-bg.py "Sticker-4x.png" "Sticker-4x-nobg.png"

Upscale first (with the white background still on), then cut. An upscaler that
gets a transparent PNG turns the faint pixels around the art into haze, but one
that gets a white background has no transparency to mangle, so the cut happens
once, on the final pixels.

AI cutout tools (Apple's built-in one, rembg, remove.bg) guess at a subject: on
the Zerble & Lurleen art, Apple's kept the two carts and dropped the lettering,
bubbles, and flowers. A flat white background doesn't need guessing:

1. Background is near-white, unsaturated pixels flood-filled from the image's
   border. That includes the faint grey shading the generator leaves in pockets
   between elements. White art the flood can't reach (petals, eyes, teeth,
   highlights, the glassy rims on bubbles) is protected and stays solid.
2. Edge ring: art pixels within RING px of the background are treated as a mix
   of the background colour and the deepest colour within twice that distance
   (the black of an outline, the green of a leaf). Alpha is how far along that
   mix each pixel sits, and the white is taken back out of its colour, so a dark
   shirt doesn't show a pale fringe or a grey line along black outlines.
3. Specks: anything visible but detached from the art and smaller than SPECK px
   is removed, since that's what prints as glitchy particles.
4. Pixels that end up fully transparent take the nearest art colour underneath,
   so a resize that ignores transparency can't pull white back in.

Sizes are tuned for a 1254px original and scale with the image. Check the result
on a dark background before uploading: compositing it over black or navy shows
any fringe or leftover speck right away.
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

Image.MAX_IMAGE_PIXELS = None
T_BG, S_BG = 215, 14        # background: every channel >= T_BG, channels within S_BG of each other
T_WHITE, S_WHITE = 244, 8   # near-white art, protected wherever the flood didn't reach it
RING_AT_1254 = 1            # edge ring width at 1254px
SPECK_AT_1254 = 6           # speck area at 1254px; a 9px sparkle there must survive


def reachable(region, seeds):
    lab, _ = ndi.label(region | seeds)
    ids = np.unique(lab[seeds])
    return np.isin(lab, ids[ids > 0])


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.split("\n\n")[1], file=sys.stderr)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    im = Image.open(src)
    rgb8 = np.asarray(im.convert("RGB"))
    H, W_px = rgb8.shape[:2]
    scale = max(H, W_px) / 1254
    mn, mx = rgb8.min(axis=2).astype(np.int16), rgb8.max(axis=2).astype(np.int16)
    border = np.zeros(mn.shape, bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True

    # 1. background
    cand = (mn >= T_BG) & (mx - mn <= S_BG)
    clear = reachable(cand, border & cand)
    protected = (mn >= T_WHITE) & (mx - mn <= S_WHITE) & ~clear
    rgb = rgb8.astype(np.float32)
    W = rgb[clear].mean(axis=0, dtype=np.float64).astype(np.float32)   # float64: millions of pixels
    dist = np.sqrt(((rgb - W) ** 2).sum(axis=2))
    alpha = np.where(clear, 0.0, 1.0).astype(np.float32)
    out = rgb.copy()

    # 2. edge ring
    ring = max(1, round(RING_AT_1254 * scale))
    reach = 2 * ring
    ey, ex = np.nonzero(~clear & ~protected & (ndi.distance_transform_edt(~clear) <= ring))
    best_d = dist[ey, ex].copy()
    best_y, best_x = ey.copy(), ex.copy()
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            if dy * dy + dx * dx > reach * reach:
                continue
            ny, nx = np.clip(ey + dy, 0, H - 1), np.clip(ex + dx, 0, W_px - 1)
            d = np.where(clear[ny, nx], -1, dist[ny, nx])
            better = d > best_d
            best_d[better], best_y[better], best_x[better] = d[better], ny[better], nx[better]
    u = W - rgb[best_y, best_x]
    a = np.clip(((W - rgb[ey, ex]) * u).sum(axis=1) / np.maximum((u * u).sum(axis=1), 1), 0, 1)
    a[a < 0.04] = 0
    alpha[ey, ex] = a
    keep = a > 0
    c = rgb[ey[keep], ex[keep]]
    out[ey[keep], ex[keep]] = np.clip((c - (1 - a[keep, None]) * W) / a[keep, None], 0, 255)

    # 3. specks
    lab, _ = ndi.label(alpha > 0)
    sizes = np.bincount(lab.ravel())
    speck = sizes < SPECK_AT_1254 * scale * scale
    speck[0] = False
    alpha[speck[lab]] = 0

    # 4. colour under transparent pixels
    art = alpha > 0
    _, (iy, ix) = ndi.distance_transform_edt(~art, return_indices=True)
    cy, cx = np.nonzero(~art)
    out[cy, cx] = out[iy[cy, cx], ix[cy, cx]]

    rgba = np.dstack([out, alpha * 255]).round().astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(dst, dpi=im.info.get("dpi", (300, 300)), compress_level=9)
    pieces = int((sizes[1:] >= SPECK_AT_1254 * scale * scale).sum())
    print(f"{dst}: background {W.round(1)}, {(alpha == 0).mean():.1%} transparent, "
          f"{pieces} visible pieces, {int(speck.sum())} specks removed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
