#!/usr/bin/env python3
"""Rebuild assets/img/ from the full-resolution originals in art/.

The originals live in art/ (stickers as lossless WebP, photos as they came off
the phone). Point ZERBLE_ART somewhere else to build from another folder.

    python3 scripts/build-images.py

Needs `cwebp` (brew install webp) and Pillow (pip3 install pillow).
Each image gets a WebP at two widths for srcset, plus one PNG/JPG fallback for
browsers without WebP. The og:image share card is composited separately.
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ART = Path(os.environ.get("ZERBLE_ART", ROOT / "art"))
OUT = ROOT / "assets" / "img"

# name: (original in art/, [webp widths], fallback format, fallback width, webp quality)
IMAGES = {
    "zerble-neon": ("sticker-neon-zerble.webp", [480, 960], "png", 640, 72),
    "zerble-psychedelic": ("sticker-psychedelic.webp", [460, 920], "jpg", 640, 82),
    "zerble-lurleen": ("sticker-zerble-lurleen.webp", [560, 1120], "png", 720, 82),
    "zerble-pixel": ("sticker-pixel.webp", [300, 600], "png", 400, 82),
    "game-dusk": ("game-dusk-screenshot.jpg", [640, 1280], "jpg", 1280, 80),
    "zerble-logo": ("logo-synthwave.webp", [512], "png", 512, 82),
    # The origin-story timeline (old phone photos, so JPG fallbacks)
    "history-napkin": ("history-napkin-2011.webp", [480, 960], "jpg", 960, 80),
    "history-first-eyeball": ("history-first-eyeball-2011.webp", [360, 720], "jpg", 720, 80),
    "history-magbuds-cart": ("history-magbuds-cart-2011.webp", [360, 720], "jpg", 720, 80),
    "history-night-eyes": ("history-night-eyes.webp", [360, 720], "jpg", 720, 80),
    # The art wall
    "art-poster": ("poster-psychedelic.webp", [400, 800], "jpg", 800, 80),
    "art-space-cruise": ("space-cruise.webp", [640, 1280], "jpg", 1280, 80),
    "art-mini-zerbles": ("mini-zerbles.webp", [480, 960], "jpg", 960, 80),
}
# The napkin photo is dim, so stretch its levels a little before encoding.
AUTOCONTRAST = {"history-napkin"}
OG_SOURCE = "sticker-neon-zerble-with-url.webp"   # the one with zerble.net on it, for social shares
OG_BACKGROUND = (26, 20, 48, 255)                         # --night


def webp(src: Path, dest: Path, width: int, quality: int) -> None:
    subprocess.run(
        ["cwebp", "-quiet", "-q", str(quality), "-alpha_q", "88", "-resize", str(width), "0", str(src), "-o", str(dest)],
        check=True,
    )


def fallback(src: Path, dest: Path, fmt: str, width: int) -> None:
    im = Image.open(src)
    im.thumbnail((width, width * 2), Image.LANCZOS)
    if fmt == "jpg":
        im.convert("RGB").save(dest, quality=82, optimize=True, progressive=True)
    else:
        # A 256-color palette keeps transparent stickers small; nearly every browser gets the WebP anyway.
        im.convert("RGBA").quantize(256, method=Image.Quantize.FASTOCTREE).save(dest, optimize=True)


def og_card() -> None:
    sticker = Image.open(ART / OG_SOURCE).convert("RGBA")
    sticker.thumbnail((590, 590), Image.LANCZOS)
    card = Image.new("RGBA", (1200, 630), OG_BACKGROUND)
    card.alpha_composite(sticker, ((1200 - sticker.width) // 2, 20))
    card.convert("RGB").save(OUT / "og-card.jpg", quality=86, optimize=True)


def main() -> int:
    missing = [spec[0] for spec in IMAGES.values() if not (ART / spec[0]).exists()]
    if not (ART / OG_SOURCE).exists():
        missing.append(OG_SOURCE)
    if missing:
        print(f"Missing originals in {ART}:\n  " + "\n  ".join(missing), file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    for name, (original, widths, fmt, fb_width, quality) in IMAGES.items():
        src = ART / original
        if name in AUTOCONTRAST:
            adjusted = tmp / f"{name}.png"
            ImageOps.autocontrast(Image.open(src).convert("RGB"), cutoff=1).save(adjusted)
            src = adjusted
        for w in widths:
            webp(src, OUT / f"{name}-{w}.webp", w, quality)
        fallback(src, OUT / f"{name}-{fb_width}.{fmt}", fmt, fb_width)
        print(f"{name}: {', '.join(f'{w}w' for w in widths)} webp + {fb_width}px {fmt}")
    og_card()
    print("og-card.jpg: 1200x630")
    return 0


if __name__ == "__main__":
    sys.exit(main())
