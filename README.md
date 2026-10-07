# zerble.net

The home page for Zerble, the golf cart with googly eyes and a giant purple mustache. It's a single static page with no build step, and it links out to the game and to Instagram:

- Game: <https://garyreckard.github.io/zerble-at-the-festival/>
- Instagram: <https://www.instagram.com/zerble_art_cart/>

The setup follows the RADish Fest site (`~/Sites/raddish-fest`): a per-letter hero wordmark that pops on hover and runs a one-time intro sweep, a JSON-LD `@graph` with cross-linked `@id`s, and the full set of crawler files.

## What's here

| Path | What it does |
|---|---|
| `index.html` | The page, with meta, Open Graph, and Twitter tags plus JSON-LD (`WebSite`, `WebPage`, `ImageObject`, `VisualArtwork` for Zerble, `VideoGame` for the game, `Person`) |
| `404.html` | Self-contained `noindex` page. GitHub Pages serves it for any missing path, so its assets use absolute `https://zerble.net/` URLs, which means a new image for it only shows up after it's pushed. Its headline is the furry-eyeball 404 sticker (`error-404` in the image script) |
| `assets/css/styles.css` | All styles. The palette tokens come off the sticker art |
| `assets/js/site.js` | The wordmark pop, intro sweep, and idle wave (ported from RADish Fest), the hero parallax, the bubble pump that runs the tip section, and bubble popping on the floating background bubbles |
| `assets/js/timeline-cart.js` | The little Zerble that drives down the story's road (see [the timeline cart](#the-timeline-cart)) |
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

The script rebuilds `assets/img/` from the originals in `art/`, writing a WebP at two widths for each `srcset` plus one PNG or JPG fallback, and it sizes the 1200×630 share card from `art/og-card.png`. Share previews cache images hard, so when the card changes, bump the `?v=` on the `og:image` and `twitter:image` URLs in `index.html`. To add a photo, drop the original in `art/`, add a line to the mapping at the top of the script, and run it. It needs `cwebp` (`brew install webp`) and Pillow 11.2 or newer.

The hero layers get two extra steps. The script clears the faint haze that background removal left around them (anything under 6% opacity, which can't be seen on the page but cost about 15% of each file), and it writes an AVIF at each width alongside the WebP. Their `<picture>` lists the AVIF first, and the hero preload points at the cart's AVIF, so if the cart's format or widths ever change, change the preload with it or the cart downloads twice. Together with capping the two back layers at 780px wide, that took the hero from about 560 KB to about 220 KB on a retina screen.

## The hero parallax

The hero art is three transparent layers cut from the same sticker and stacked in one grid cell: the bubble arch at the back, the corner splashes in the middle, and the cart up front (`art/sticker-hero-layer-*.webp`, built to `zerble-hero-arch`, `-corners`, and `-cart`). All three share one 1402×1122 canvas, so a replacement layer has to keep that size and registration or the stack won't line up.

`site.js` hands the stack which way you're looking at it (the mouse position over the hero, or how a phone is tilted) and how far the hero has scrolled, and each `.hero-layer--*` rule in `styles.css` decides what to do with them. `--x` and `--y` are where a layer rests, as a share of the art's width and height, so they scale with the art (the arch sits a little higher and to the right of where it was drawn, and the corner splashes sit lower and to the left). `--reach` is how far a layer follows the mouse or tilt (positive follows the cursor, negative leans away), and `--lag` is how much of the scroll a layer trails behind, so higher numbers on both read as farther away. Each layer also bobs on its own clock (`--bob`, `--rise`) and gets a drop shadow that deepens toward the front, and `--tone` softens and darkens the back two (the arch more than the corners), like a camera focused on the cart. Reduced motion turns all of it off.

Phone tilt is measured from however the phone is being held, and that resting angle catches up over a couple of seconds, so a lean shows as motion and then settles back to center. Android shares tilt readings without asking. iPhones and iPads only share them after a tap and a yes on Safari's motion prompt, so on those the "Tap to tilt" chip (`.tilt-chip`) shows up on the art, and it hides again once readings arrive. Tilt readings only exist on HTTPS (or localhost), so a phone pointed at the dev server over the LAN won't tilt; test it on the live site or through an HTTPS tunnel.

## The hero signpost

The wooden signpost under the hero buttons is the page's table of contents. Each board is a link in `.signpost` that jumps to a section, and the boards cross the post in pairs, one pointing each way. List the boards in page order and alternate `to-r` and `to-l`. The grid pairs each left board with the right board above it, so the post stays three rows tall and fits above the fold on a 1280×800 laptop.

Every board sets its own look inline: `--rot` tilts it, `--ry` turns it toward you (negative) or away from you (positive), `--wood` picks the plank color, and `--paint` picks the lettering color from the palette. Keep labels short, since a board on a phone has about 180px to work with.

## The timeline cart

A little Zerble drives down the dashed road in the story section. While you scroll down he drives toward you, when you scroll back up he flips around to show the bubble butt, machine and all, and when you stop he idles with a gentle bob while his eyes glance around. Visitors who've asked for reduced motion get him parked, so he still rides along with the page, but nothing bobs, wobbles, or blows bubbles.

`timeline-cart.js` draws him in SVG from code instead of from an image, so every part can move on its own. The body bobs on a sine wave with a little squash and stretch, the eyes ride a spring a beat behind it, the irises rattle around inside them like real googly eyes, the mustache wobbles, and bubbles rise from behind the roof (or, from behind, blow straight toward you). He's drawn on a 240×240 canvas, and `layout()` places every part. `CAMERA` sets how high the camera sits, from 0 (straight on) to 1 (way up high), which decides how much of the roof you see and how much he narrows toward the wheels; the page uses 0.8. The handlebar mustache is two mirrored halves built around the centerline in `BAR`, where each point is an x, a y, and a half-thickness, and `MODES` and `K` hold all of the motion numbers.

The script adds an extra `<li class="road-cart">` laid over the timeline (hidden from screen readers), and `styles.css` makes the car inside it sticky. He waits at the start of the road, rides in the middle of the screen while the story scrolls past, and parks on the road just above the last moment, since his track ends where that card starts. The centered cards sit right on the road, so they stack above him and he drives under them like a bridge. He drives (a faster bob, a side-to-side roll, and the odd road bump) only while he's actually moving along the road, so once he's parked at either end he idles even while the page keeps scrolling, and he only turns around after about 24px of travel the other way, so a jiggle or an overscroll bounce doesn't spin him. He's 72px wide on desktop and 44px on phones, where the road moves over to the left edge, and his ink outline gets thicker as he gets smaller so it stays about 1.7px on screen.

`sandbox/timeline-cart.html` is a local design page that draws the same cart big, at real size, and from behind, with controls for motion, heading, camera height, and size. It's listed in `.git/info/exclude` rather than `.gitignore`, so it never deploys and only exists on the machine it was made on.

## The handlers' passes

Gary's and Locke's All Access passes in `#handlers` are shaped like a 4×6 festival credential (`aspect-ratio: 2 / 3` on `.pass`, as a floor, so a pass with a longer list just grows taller), and each one hangs from a lanyard. The pass tilts around its clip rather than its middle, its `--band` color sets the top band and tints the strap, and the clip and the barcode are the `.pass-top` band's `::before` and `::after`. The strap is the pass's own `::after`, a V cut with `clip-path` that fades out on its way up. It sits behind everything around it because `.handlers-head` and every `.snap` in the section are lifted to `z-index: 1`, so a new photo or block added to the section needs the same treatment or the strap will draw over it.

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

## Spotted Zerble? (fan photos)

The Instagram section at the bottom of the page ends with a `.spotted` card that asks people who've photographed Zerble to post it with `#zerble` and tag `@zerble_art_cart`. The two tags are drawn as the same festival wristbands the timeline uses (`.bands`). The hashtag also appears in `llms.txt`, so if it ever changes, change it in both places, along with anything printed for the cart.

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
