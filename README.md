# zerble.net

The home page for Zerble, the golf cart with googly eyes and a giant purple mustache. It's a single static page with no build step, and it links out to the game and to Instagram:

- Game: <https://garyreckard.github.io/zerble-at-the-festival/>
- Instagram: <https://www.instagram.com/zerble_art_cart/>

The setup follows the RADish Fest site (`~/Sites/raddish-fest`): a per-letter hero wordmark that pops on hover and runs a one-time intro sweep, a JSON-LD `@graph` with cross-linked `@id`s, and the full set of crawler files.

## What's here

| Path | What it does |
|---|---|
| `index.html` | The page, with meta, Open Graph, and Twitter tags plus JSON-LD (`WebSite`, `WebPage`, `ImageObject`, `VisualArtwork` for Zerble, `VideoGame` for the game, `Person`) |
| `404.html` | Self-contained `noindex` page. GitHub Pages serves it for any missing path, so its assets use absolute `https://zerble.net/` URLs |
| `assets/css/styles.css` | All styles. The palette tokens come off the sticker art |
| `assets/js/site.js` | The wordmark pop and intro sweep (ported from RADish Fest), plus a bubble puff on every pop |
| `assets/js/analytics.js` | GA4 events: outbound and CTA clicks (with `data-ga` names), scroll depth, and section views |
| `assets/img/` | Generated images. Don't edit by hand, run the script below |
| `art/` | The full-resolution originals the images are built from (stickers as lossless WebP, photos as they came off the phone) |
| `robots.txt`, `sitemap.xml`, `llms.txt` | Crawler files. AI crawlers are welcomed explicitly, and `llms.txt` is a plain-language summary for answer engines |
| `site.webmanifest`, icons | App manifest and favicons, shared with the game |
| `CNAME`, `.nojekyll` | GitHub Pages custom domain, and skip Jekyll processing |

When you change `styles.css` or a script, bump its `?v=` date in `index.html` so returning visitors get the new file. When the content changes, bump `<lastmod>` in `sitemap.xml`.

## Local preview

```bash
python3 -m http.server 8770 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8770/>. Every asset path in `index.html` is relative, so it also works under any host.

## Images

```bash
python3 scripts/build-images.py
```

The script rebuilds `assets/img/` from the originals in `art/`, writing a WebP at two widths for each `srcset` plus one PNG or JPG fallback, and it composites the 1200×630 share card. To add a photo, drop the original in `art/`, add a line to the mapping at the top of the script, and run it. It needs `cwebp` (`brew install webp`) and Pillow.

Two early photos (the MagBuds cart with friends posing beside it, and two riders in the cart) are kept out of the repo until everyone in them is okay with being on a public site.

## Analytics

GA4 uses the game's property and tag (`G-CY1FNMY8H8`), so all Zerble traffic lands in one place and you can split it by hostname. The tag only loads on `zerble.net`, so local previews never send hits. To give the site its own property instead, swap the ID in the `<head>` snippet.

So a visit that starts here and clicks through to the game counts as one journey, turn on cross-domain measurement in GA4 for this tag with both `zerble.net` and `garyreckard.github.io` listed (it lives under the web data stream's tag settings, "Configure your domains"). The Google tag then adds a `_gl` parameter to links between the two sites on its own, with no code change on either side.

`analytics.js` names the important clicks with `data-ga`: `book_preorder`, `book_about`, `book_announce`, `play_game_hero`, `play_game_section`, `play_game_timeline`, `instagram_hero`, `instagram_section`, and `lamplight_artwalk`. Outbound ones arrive as `outbound_click` events with that name in `link_text`.

## Hosting

GitHub Pages serves this repo from the `main` branch root, and the `CNAME` file pins the custom domain to `zerble.net`. The domain is registered in Route53 on Gary's personal AWS account (not the Happy Cog one), and the zone needs these records:

| Name | Type | Value |
|---|---|---|
| `zerble.net` | A | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| `zerble.net` | AAAA | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| `www.zerble.net` | CNAME | `garyreckard.github.io` |
| `_github-pages-challenge-GaryReckard.zerble.net` | TXT | the code GitHub shows under Settings → Pages → Verified domains |

The IPs come from GitHub's [custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site). Don't add a wildcard (`*.zerble.net`) record, because GitHub warns that it opens the domain to takeover.

The custom domain lives on this project repo on purpose. Setting it on the `garyreckard.github.io` user site instead would move every project site under it. The game would then jump to `zerble.net/zerble-at-the-festival/`, and players would lose their saved name, best score, and mode, because the game keeps those in `localStorage`, which is tied to the origin.

## Fonts

Titan One, Nunito, and Press Start 2P all load from Google Fonts.
