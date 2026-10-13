#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "scipy"]
# ///
"""Clean the haze an AI upscaler leaves in a transparent sticker PNG.

    uv run scripts/clean-alpha.py "Sticker-4x.png" "Sticker-4x-clean.png" [--soft]

Upscaling a transparent PNG (Gigapixel, at least) spreads the faint pixels around
the art into a haze that covers 4 to 15% of the canvas, and Redbubble can print
that haze as glitchy particles. The art itself usually comes back 94 to 99%
opaque rather than solid, and its edges fade out across a wide soft band. This
writes a cleaned copy and leaves the original alone.

Pick the mode by the art:

  default   Hard-edged art, like the pixel sticker. Anything more than EDGE_PX
            from solid art is cleared, and alpha is levelled so LO and below
            becomes 0, HI and above becomes 255, and the edge in between is
            stretched to stay crisp.
  --soft    Illustrations with translucent sparkles, glows, or glass. Faint
            pixels only survive if they connect to solid art through pixels of
            at least LO, so a soft sparkle stays whole while loose haze goes.
            Below LO becomes 0, HI and above becomes 255, and the values in
            between are left as they are.

Both modes then:

- drop solid specks smaller than SPECK px that nothing connects to,
- make everything more than INTERIOR px inside the solid art fully solid (holes
  meant to be see-through, like the windows under a cart's canopy, are
  transparent, so the art around them stays within INTERIOR px and isn't
  touched), and
- give fully transparent pixels the nearest art colour underneath, so a resize
  that ignores transparency can't pull noise or dark fringes back in.

Sizes marked _AT_1254 are tuned for a 1254px original and scale with the image.
Check the cleaned copy against the original before uploading, especially any
tiny sparkle that sits apart from the rest of the art.
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

Image.MAX_IMAGE_PIXELS = None
LO, HI = 24, 240           # alpha below LO is haze; HI and above is meant to be solid
EDGE_PX_AT_1254 = 0.75     # default mode: how far past solid art the edge may reach
INTERIOR_AT_1254 = 3       # deeper than this inside solid art becomes fully solid
SPECK_AT_1254 = 6          # speck area at 1254px; a 9px sparkle there must survive


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    soft = "--soft" in sys.argv[1:]
    if len(args) != 2:
        print(__doc__.split("\n\n")[1], file=sys.stderr)
        return 2
    src, dst = args
    im = Image.open(src)
    a = np.array(im.convert("RGBA"))
    al = a[..., 3].astype(np.float32)
    scale = max(al.shape) / 1254

    lab, _ = ndi.label(al >= 128)
    sizes = np.bincount(lab.ravel())
    keep = sizes >= SPECK_AT_1254 * scale * scale
    keep[0] = False
    solid = keep[lab]
    specks = int((sizes[1:] < SPECK_AT_1254 * scale * scale).sum())

    if soft:
        lab, _ = ndi.label(al >= LO, structure=np.ones((3, 3)))
        seeds = np.unique(lab[solid])
        attached = np.isin(lab, seeds[seeds > 0])
        new_al = np.where(al >= HI, 255, al)
        new_al[~attached | (al < LO)] = 0
    else:
        near = ndi.distance_transform_edt(~solid) <= max(1, EDGE_PX_AT_1254 * scale)
        new_al = np.clip((al - LO) / (HI - LO) * 255, 0, 255)
        new_al[~near] = 0

    interior = ndi.distance_transform_edt(solid) > INTERIOR_AT_1254 * scale
    filled = int(((new_al < 255) & interior).sum())
    new_al[interior] = 255
    new_al = np.rint(new_al).astype(np.uint8)

    clear = new_al == 0
    _, (iy, ix) = ndi.distance_transform_edt(~solid, return_indices=True)
    rgb = a[..., :3]
    rgb[clear] = rgb[iy[clear], ix[clear]]
    a[..., 3] = new_al

    Image.fromarray(a, "RGBA").save(dst, dpi=im.info.get("dpi", (300, 300)), compress_level=9)
    h = np.bincount(new_al.ravel(), minlength=256)
    print(f"{dst}{' (soft)' if soft else ''}: {h[0] / new_al.size:.1%} transparent, "
          f"{h[255] / new_al.size:.1%} solid, {specks} specks dropped, {filled} interior px made solid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
