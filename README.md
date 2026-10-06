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
| `assets/js/site.js` | The wordmark pop, intro sweep, and idle wave (ported from RADish Fest), the bubble pump that runs the tip section, and bubble popping on the floating background bubbles |
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

The script rebuilds `assets/img/` from the originals in `art/`, writing a WebP at two widths for each `srcset` plus one PNG or JPG fallback, and it sizes the 1200×630 share card from `art/og-card.png`. Share previews cache images hard, so when the card changes, bump the `?v=` on the `og:image` and `twitter:image` URLs in `index.html`. To add a photo, drop the original in `art/`, add a line to the mapping at the top of the script, and run it. It needs `cwebp` (`brew install webp`) and Pillow.

## The hero signpost

The wooden signpost under the hero buttons is the page's table of contents. Each board is a link in `.signpost` that jumps to a section, and the boards cross the post in pairs, one pointing each way. List the boards in page order and alternate `to-r` and `to-l`. The grid pairs each left board with the right board above it, so the post stays three rows tall and fits above the fold on a 1280×800 laptop.

Every board sets its own look inline: `--rot` tilts it, `--ry` turns it toward you (negative) or away from you (positive), `--wood` picks the plank color, and `--paint` picks the lettering color from the palette. Keep labels short, since a board on a phone has about 180px to work with.

## The bubble fund (tip section)

The `#bubble-juice` section is a tip jar dressed as a gas pump. Picking an amount ticks the pump screen over, fills the four jugs (one box of juice), and rewrites the tip link to carry that amount. Venmo takes `?txn=pay&amount=10&note=...`, and the $10 default is baked into the HTML `href`, so the link works without JavaScript.

- **Account:** tips go to Zerble's Venmo business profile, [@zerble](https://venmo.com/zerble). The handle lives in the `href` on `.btn-venmo` in `index.html`, and `site.js` reads it from there, so that's the only place to change it. Keep tips on a business profile, because Venmo's rules say personal profiles shouldn't receive donation-style payments from people you don't know.
- **PayPal (hidden for now):** `site.js` already knows PayPal.me's format (the amount goes on the end of the path, as in `/10USD`). To bring the button back, add this under the Venmo link in `.pump-pay`, using a PayPal business account's PayPal.me name:

  ```html
  <a class="btn btn-paypal" href="https://paypal.me/NAME/10USD" data-pay="paypal" data-ga="tip_paypal" data-ga-amount="10"><span>Tip <span class="amt">$10</span> with PayPal</span></a>
  ```
- **Price per gallon:** `data-price` on `.pump` (currently `22.50`, from a $90 box of four gallons), plus the matching `Price/gal` line in the screen markup.
- **Amounts:** the four radio buttons in `.grades`. The labels describe the juice each amount buys, so update them if the price moves much.

## The merch tent (Redbubble)

The `#merch` section sits between the art wall and Instagram, and it links out to Zerble's Redbubble collection. Each design gets one card in `.merch-grid`: its sticker as the big image, two products underneath, and a button to every product with that design. The last card links to the whole collection. Redbubble runs sales most weeks, so the cards leave prices off on purpose.

The product photos are Redbubble's own mockups, saved to `art/shop-<design>-<product>.jpg` and run through the image script like everything else, so the page never hotlinks Redbubble. To grab one, open the product page, copy its `og:image` URL, and swap `600x600` for `1000x1000` (and `x600` for `x1000`, or `507x507` for `845x845` on stickers) to get the 1000px version.

To add a design:

1. Save its sticker and two product mockups to `art/` as `shop-<design>-sticker.jpg` and so on.
2. Add them to the merch-tent block in `scripts/build-images.py` (stickers at `[320, 640]`, products at `[180, 360]`) and run the script.
3. Copy a card in `index.html`, then swap the links, images, alt text, `data-ga` names, and the `--accent` color (any palette token from the top of `styles.css`). Keep the "whole shop" card last.

The cards are a three-column grid on desktop, two columns on tablets, and a row you swipe through on phones, so any number of designs works.

## Analytics

GA4 uses the game's property and tag (`G-CY1FNMY8H8`), so all Zerble traffic lands in one place and you can split it by hostname. The tag only loads on `zerble.net`, so local previews never send hits. To give the site its own property instead, swap the ID in the `<head>` snippet.

So a visit that starts here and clicks through to the game counts as one journey, turn on cross-domain measurement in GA4 for this tag with both `zerble.net` and `garyreckard.github.io` listed (it lives under the web data stream's tag settings, "Configure your domains"). The Google tag then adds a `_gl` parameter to links between the two sites on its own, with no code change on either side.

`analytics.js` names the important clicks with `data-ga`: `book_preorder`, `book_about`, `book_announce`, `play_game_hero`, `play_game_section`, `play_game_timeline`, `instagram_hero`, `instagram_section`, `facebook_section`, `lamplight_artwalk`, `tip_venmo` (plus `tip_paypal` if that button comes back), and the merch tent's `shop_<design>_<product>`, `shop_<design>_all`, and `shop_collection` (for example `shop_neon_pillow`), plus the hero signpost's boards (`signpost_bubble_fund`, `signpost_story`, `signpost_crew`, `signpost_lurleen`, `signpost_game`, and `signpost_merch`). Outbound ones arrive as `outbound_click` events with that name in `link_text`, and the signpost boards, which jump to a section on the same page, arrive as `anchor_click` events the same way. The tip links also send the picked dollar amount as an `amount` param. GA4 only reports a custom param after you register it, so add `amount` as a custom metric (Admin, then Custom definitions) to see it in reports. These clicks measure intent, not money received, since the payment itself happens in Venmo.

Popping the floating background bubbles sends a `bubble_pop` event with a `popped` count, but only at 1, 10, 25, 50, and 100 pops, so a bubble-popping spree doesn't flood GA.

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
