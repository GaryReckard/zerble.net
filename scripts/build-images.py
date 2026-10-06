#!/usr/bin/env python3
"""Rebuild assets/img/ from the full-resolution originals in art/.

The originals live in art/ (stickers as lossless WebP, photos as they came off
the phone). Point ZERBLE_ART somewhere else to build from another folder.

    python3 scripts/build-images.py

Needs `cwebp` (brew install webp) and Pillow (pip3 install pillow).
Each image gets a WebP at two widths for srcset, plus one PNG/JPG fallback for
browsers without WebP. The og:image share card is sized separately.
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
    "zerble-hero": ("sticker-hero-bubbles.webp", [520, 1040], "png", 720, 74),
    "zerble-psychedelic": ("sticker-psychedelic.webp", [460, 920], "jpg", 640, 82),
    "zerble-lurleen": ("sticker-zerble-lurleen.webp", [560, 1120], "png", 720, 82),
    "zerble-pixel": ("sticker-pixel.webp", [300, 600], "png", 400, 82),
    "game-dusk": ("game-dusk-screenshot.jpg", [640, 1280], "jpg", 1280, 80),
    "zerble-logo": ("logo-synthwave.webp", [512], "png", 512, 82),
    "handlers": ("handlers-locke-gary.webp", [560, 1120], "jpg", 1120, 80),
    "handlers-hot-dog": ("handlers-locke-hot-dog.webp", [360, 720], "jpg", 720, 80),
    "book-cover": ("book-cover-front.webp", [300, 600], "jpg", 600, 84),
    "zerbubbles": ("zerbubbles-grass.webp", [800, 1600], "jpg", 1600, 72),
    # The origin-story timeline (old phone photos, so JPG fallbacks)
    "history-napkin": ("history-napkin-2011.webp", [480, 960], "jpg", 960, 80),
    "history-first-eyeball": ("history-first-eyeball-2011.webp", [360, 720], "jpg", 720, 80),
    "history-glowing-eyes": ("history-glowing-eyes-2011.webp", [400, 800], "jpg", 800, 80),
    "history-el-wire": ("history-el-wire-mustache.webp", [360, 720], "jpg", 720, 80),
    "history-bear-creek-2014": ("history-bear-creek-bowtie-2014.webp", [360, 720], "jpg", 720, 80),
    "history-springfest-2016": ("history-springfest-2016.webp", [360, 720], "jpg", 720, 80),
    "history-french-broad-2016": ("history-french-broad-2016.webp", [360, 720], "jpg", 720, 80),
    "history-before-2016": ("history-red-ezgo-before-2016.webp", [400, 800], "jpg", 800, 80),
    "history-night-life": ("history-night-life.webp", [400, 800], "jpg", 800, 80),
    "history-bubble-machine": ("bubble-machine.webp", [400, 800], "jpg", 800, 80),
    "history-wedding-2017": ("history-wedding-2017.webp", [360, 720], "jpg", 720, 80),
    "history-button-2018": ("button-i-rode-zerble-2018.jpg", [400, 800], "jpg", 800, 80),
    "token-zerble": ("token-zerble-side.webp", [180, 360], "png", 360, 82),
    "token-fan-club": ("token-fan-club-side.webp", [180, 360], "png", 360, 82),
    "history-disney-2019": ("history-disney-2019.webp", [320, 640], "jpg", 640, 80),
    "history-disney-lineup-2019": ("history-disney-lineup-2019.webp", [320, 640], "jpg", 640, 80),
    "history-darwin-2023": ("history-darwin-onesie-2023.webp", [400, 800], "jpg", 800, 80),
    "history-rc-zerble": ("rc-zerble.webp", [360, 720], "jpg", 720, 80),
    "history-northern-lights-2024": ("history-northern-lights-2024.webp", [360, 720], "jpg", 720, 80),
    # From the archives (the early years, oldest first)
    "archive-magbuds-cart": ("history-magbuds-cart-2011.webp", [360, 720], "jpg", 720, 80),
    "archive-riders-2011": ("history-riders-springfest-2011.webp", [360, 720], "jpg", 720, 80),
    "archive-night-eyes": ("history-night-eyes.webp", [360, 720], "jpg", 720, 80),
    "archive-party-time": ("history-party-time.webp", [360, 720], "jpg", 720, 80),
    "archive-bear-creek-red-eyes": ("archive-bear-creek-red-eyes-2014.webp", [360, 720], "jpg", 720, 80),
    "archive-bear-creek-night": ("archive-bear-creek-night-2014.webp", [360, 640], "jpg", 640, 80),
    "archive-springfest-night": ("history-springfest-2016-night.webp", [360, 720], "jpg", 720, 80),
    # The art wall
    "art-poster": ("poster-psychedelic.webp", [400, 800], "jpg", 800, 80),
    "art-space-cruise": ("space-cruise.webp", [640, 1280], "jpg", 1280, 80),
    "art-mini-zerbles": ("mini-zerbles.webp", [480, 960], "jpg", 960, 80),
}
# The napkin photo is dim, so stretch its levels a little before encoding.
AUTOCONTRAST = {"history-napkin"}
OG_SOURCE = "og-card.png"   # the finished social share card (Zerble under the marquee sign, with zerble.net)


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
    # Fit to the 1.91:1 size Facebook, Instagram, and X expect, cropping from the center if needed.
    card = ImageOps.fit(Image.open(ART / OG_SOURCE).convert("RGB"), (1200, 630), Image.LANCZOS)
    card.save(OUT / "og-card.jpg", quality=86, optimize=True, progressive=True)


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
