/* zerble.net — the timeline cart.
   A little Zerble drives down the story's dashed road. He's drawn here in SVG, seen
   from up high and out front, with parts that move on their own: the body bobs on its
   springs, the eyes ride a beat behind it, the irises rattle around like real googly
   eyes, and the bubble machine blows bubbles. Scrolling down, he drives toward you;
   scroll back up and he flips around to show the bubble butt. When you stop, he idles.

   The drawing and the motion live in window.ZerbleCart so the local design sandbox
   (sandbox/timeline-cart.html, kept out of git) can draw the same cart at any size. The
   bottom of this file puts one on the page. styles.css (under "the timeline cart") sizes
   it and makes it ride the road. */
(function () {
    'use strict';

    var SVGNS = 'http://www.w3.org/2000/svg';
    var CAMERA = 0.8;   // how high the camera sits: 0 is straight on, 1 is way up high
    var uid = 0;

    // ---------- small helpers ----------

    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
    function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
    function f1(n) { return Math.round(n * 10) / 10; }
    function pt(p) { return f1(p[0]) + ' ' + f1(p[1]); }

    // Closed Catmull-Rom spline through the points, as cubic Béziers.
    function smooth(pts) {
        var n = pts.length, d = 'M' + pt(pts[0]);
        for (var i = 0; i < n; i++) {
            var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
            d += 'C' + f1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
                f1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + pt(p2);
        }
        return d + 'Z';
    }

    // Open Catmull-Rom through [x, y, w] points, `sub` samples per span, w interpolated.
    function densify(pts, sub) {
        var out = [], n = pts.length;
        for (var i = 0; i < n - 1; i++) {
            var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
            for (var s = 0; s < sub; s++) {
                var u = s / sub, u2 = u * u, u3 = u2 * u, q = [];
                for (var k = 0; k < 2; k++) {
                    q[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
                }
                q[2] = p1[2] + (p2[2] - p1[2]) * u;
                out.push(q);
            }
        }
        out.push(pts[n - 1].slice());
        return out;
    }

    // Walk a smooth outline (drawn clockwise) and swap every few units of edge for a
    // pointed tuft that leans away from the middle, so the fur sweeps outward like it
    // does on the sticker. Seeded, so the mustache comes out the same every time.
    function fuzz(measure, pts, seed, step, bump) {
        measure.setAttribute('d', smooth(pts));
        var L = measure.getTotalLength(), n = Math.round(L / step), rnd = mulberry32(seed), P = [];
        for (var i = 0; i < n; i++) { var p = measure.getPointAtLength(i / n * L); P.push([p.x, p.y]); }
        var d = 'M' + pt(P[0]);
        for (var j = 0; j < n; j++) {
            var a = P[j], b = P[(j + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
            var nx = dy / len, ny = -dx / len, k = bump * (0.6 + rnd() * 0.8);
            var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, side = mx < 120 ? -1 : 1;
            var tx = mx + nx * k + side * k * 0.45, ty = my + ny * k;
            d += 'Q' + f1((a[0] + tx) / 2 + nx * k * 0.2) + ' ' + f1((a[1] + ty) / 2 + ny * k * 0.2) + ' ' + f1(tx) + ' ' + f1(ty) +
                 'Q' + f1((tx + b[0]) / 2 + nx * k * 0.15) + ' ' + f1((ty + b[1]) / 2 + ny * k * 0.15) + ' ' + pt(b);
        }
        return d + 'Z';
    }

    function star(s) {
        var q = s * 0.16;
        return 'M0 ' + -s + 'Q' + q + ' ' + -q + ' ' + s + ' 0Q' + q + ' ' + q + ' 0 ' + s +
            'Q' + -q + ' ' + q + ' ' + -s + ' 0Q' + -q + ' ' + -q + ' 0 ' + -s + 'Z';
    }
    function arc(r, a0, a1) {
        var t0 = a0 * Math.PI / 180, t1 = a1 * Math.PI / 180;
        return 'M' + f1(r * Math.cos(t0)) + ' ' + f1(r * Math.sin(t0)) + 'A' + r + ' ' + r + ' 0 0 1 ' + f1(r * Math.cos(t1)) + ' ' + f1(r * Math.sin(t1));
    }

    // ---------- shared gradients, and the mustache outline ----------

    // Every cart on the page shares one hidden <svg> of gradients. The mustache outline
    // is measured along a path in there too, so it's built the first time a cart is.
    var STACHE, STACHE_HI;
    function setup() {
        if (STACHE) return;
        var defs = document.createElementNS(SVGNS, 'svg');
        defs.setAttribute('width', '0');
        defs.setAttribute('height', '0');
        defs.setAttribute('aria-hidden', 'true');
        defs.setAttribute('focusable', 'false');
        defs.style.position = 'absolute';
        defs.innerHTML = '<defs>' +
            '<radialGradient id="zc-globe" cx=".38" cy=".34" r=".78"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f6f1ff"/><stop offset="1" stop-color="#cbbde9"/></radialGradient>' +
            '<radialGradient id="zc-iris" cx=".4" cy=".36" r=".72"><stop offset="0" stop-color="#bff2ff"/><stop offset=".45" stop-color="#3fc6ff"/><stop offset="1" stop-color="#1762c4"/></radialGradient>' +
            '<linearGradient id="zc-roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff09a"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#f4b823"/></linearGradient>' +
            '<linearGradient id="zc-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4443d"/><stop offset=".6" stop-color="#e2342f"/><stop offset="1" stop-color="#b9202a"/></linearGradient>' +
            '<linearGradient id="zc-hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8576"/><stop offset="1" stop-color="#ff5a50"/></linearGradient>' +
            '<linearGradient id="zc-stache" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b590ff"/><stop offset=".55" stop-color="#9b6bff"/><stop offset="1" stop-color="#7041d8"/></linearGradient>' +
            '<linearGradient id="zc-bub" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4fa3"/><stop offset=".3" stop-color="#ffd23f"/><stop offset=".55" stop-color="#5fd35a"/><stop offset=".8" stop-color="#3fc6ff"/><stop offset="1" stop-color="#9b6bff"/></linearGradient>' +
            '<radialGradient id="zc-bubfill" cx=".5" cy=".5" r=".5"><stop offset=".6" stop-color="#ffffff" stop-opacity="0"/><stop offset=".92" stop-color="#ffffff" stop-opacity=".18"/><stop offset="1" stop-color="#ffffff" stop-opacity=".05"/></radialGradient>' +
            '</defs><path d="M0 0"/>';
        document.body.appendChild(defs);
        var measure = defs.lastChild;
        STACHE = fuzz(measure, barOutline(BAR, 1, 0), 7, 6.5, 1.5);
        STACHE_HI = smooth(barOutline(BAR, 0.42, 0.35));
    }

    // ---------- the handlebar mustache ----------

    // The right half's centerline, from under the nose out to the curl, as [x, y,
    // half-thickness]. It starts as a plump, rounded lobe next to the nose, tapers as it
    // sweeps out and a touch down, then curls up and back in on itself. The left half is
    // the same path flipped, so the two halves meet under the nose as two separate pieces.
    var BAR = [[129, 150, 13], [136, 152, 18.5], [148, 154, 20.5], [162, 157, 17], [176, 159, 12.5], [189, 159, 9], [201, 155, 7],
               [210, 148, 5.8], [214, 140, 4.8], [212, 131, 4], [205, 126, 3.3], [198, 128, 2.7], [195, 134, 2.1], [198, 139, 1.5]];

    // One half's outline, clockwise: along the top out to the curl, around its tip, back
    // along the bottom, and around the rounded inner end. thin and lift make the thinner,
    // higher sheen that sits on top.
    function barOutline(bar, thin, lift) {
        var c = densify(bar, 5), top = [], bot = [], n = c.length;
        for (var i = 0; i < n; i++) {
            var a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
            var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = dy / len, ny = -dx / len;
            var w = c[i][2] * thin, cy = c[i][1] - lift * c[i][2];
            top.push([c[i][0] + nx * w, cy + ny * w]);
            bot.push([c[i][0] - nx * w, cy - ny * w]);
        }
        function cap(e, p) {
            var l = Math.hypot(e[0] - p[0], e[1] - p[1]) || 1;
            return [e[0] + (e[0] - p[0]) / l * e[2] * thin, e[1] - lift * e[2] + (e[1] - p[1]) / l * e[2] * thin];
        }
        return top.concat([cap(c[n - 1], c[n - 2])], bot.reverse(), [cap(c[0], c[1])]);
    }

    var FLIP = 'matrix(-1 0 0 1 240 0)';
    function stache(dy) {
        function half(flip) {
            return '<path class="o" d="' + STACHE + '" fill="url(#zc-stache)"' + flip + '/>' +
                '<path d="' + STACHE_HI + '" fill="#c3a6ff" opacity=".7"' + flip + '/>';
        }
        return '<g transform="translate(0 ' + f1(dy) + ')"><g class="stache" data-px="120" data-py="154">' +
            half(' transform="' + FLIP + '"') + half('') +
            '</g></g>';
    }

    // ---------- the other parts ----------

    // An eye on the dash: the globe and its gloss stay put while the iris (.pupil)
    // rattles around inside, like a real googly eye.
    function eye(cx, cy, r) {
        var ir = r * 0.53, pr = r * 0.28;
        return '<g transform="translate(' + cx + ' ' + cy + ')">' +
            '<circle class="o" r="' + r + '" fill="url(#zc-globe)"/>' +
            '<path class="detail" d="' + arc(r * 0.8, 15, 115) + '" fill="none" stroke="#d6cbee" stroke-width="' + f1(r * 0.14) + '" stroke-linecap="round"/>' +
            '<g class="pupil" data-r="' + f1(r - ir - r * 0.1) + '">' +
                '<circle class="o2" r="' + f1(ir) + '" fill="url(#zc-iris)"/>' +
                '<circle r="' + f1(pr) + '" fill="#120c24"/>' +
                '<path d="' + star(pr * 0.62) + '" fill="#ffffff"/>' +
                '<circle cx="' + f1(-ir * 0.45) + '" cy="' + f1(-ir * 0.45) + '" r="' + f1(ir * 0.16) + '" fill="#ffffff" opacity=".85"/>' +
            '</g>' +
            '<ellipse cx="' + f1(-r * 0.42) + '" cy="' + f1(-r * 0.5) + '" rx="' + f1(r * 0.22) + '" ry="' + f1(r * 0.13) + '" transform="rotate(-35 ' + f1(-r * 0.42) + ' ' + f1(-r * 0.5) + ')" fill="#ffffff"/>' +
            '</g>';
    }
    function eyeBack(cx, cy, r) {
        return '<g transform="translate(' + cx + ' ' + cy + ')">' +
            '<circle class="o" r="' + r + '" fill="url(#zc-globe)"/>' +
            '<circle class="detail" r="' + f1(r * 0.34) + '" fill="none" stroke="#d6cbee" stroke-width="3"/>' +
            '</g>';
    }

    // An upright tire. We're looking down a little, so a lighter band across the top is
    // the tread facing up. The grooves scroll while driving.
    function tire(id, x, y, w, h) {
        var lines = '';
        for (var ly = y - 8; ly <= y + h + 8; ly += 8) lines += 'M' + x + ' ' + ly + 'h' + w;
        return '<g class="tire">' +
            '<clipPath id="' + id + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="11"/></clipPath>' +
            '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="11" fill="#2e2346"/>' +
            '<g clip-path="url(#' + id + ')"><path class="tread detail" d="' + lines + '" stroke="#18112b" stroke-width="3"/>' +
            '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="11" fill="#5a4a7a" opacity=".55"/>' +
            '<rect x="' + (x + 4) + '" y="' + y + '" width="' + f1(w * 0.22) + '" height="' + h + '" fill="#ffffff" opacity=".07"/></g>' +
            '<rect class="o" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="11" fill="none"/>' +
            '</g>';
    }

    // Everything that moves with the camera height (t, 0 = straight on, 1 = way up high).
    // Up high we see more of the roof's top and the hood, and the body narrows toward the
    // wheels because they're farther from the camera than the roof is. The canvas is
    // 240×240.
    function layout(t) {
        var L = { t: t, cx: 120 };
        L.rb = 28 - 16 * t;              // roof, back edge
        L.rf = L.rb + 7 + 32 * t;        // roof, front edge
        L.rim = 9;
        L.rfw = 106;                     // roof half-widths, front and back
        L.rbw = 106 - 32 * t;
        L.dash = 132;                    // the eyes sit here, where the hood starts
        L.hf = L.dash + 4 + 16 * t;      // hood's front edge
        L.hbw = 82; L.hfw = 92;          // hood half-widths, back and front
        L.rbot = L.hf + 34;              // where the red body ends, just under the mustache
        L.bot = 206;                     // bottom of the mouth band, and where the tires sit
        L.bw = 92 - 13 * t;              // half-width down at the bottom
        return L;
    }

    function roof(L) {
        var cx = L.cx, rb = L.rb, rf = L.rf, cr = Math.min(8, (rf - rb) / 3);
        var d = 'M' + (cx - L.rbw + 16) + ' ' + rb + 'Q' + cx + ' ' + (rb - 5) + ' ' + (cx + L.rbw - 16) + ' ' + rb +
            'Q' + (cx + L.rbw) + ' ' + rb + ' ' + f1(cx + L.rbw + 3) + ' ' + f1(rb + cr) +
            'L' + f1(cx + L.rfw) + ' ' + f1(rf - cr) + 'Q' + (cx + L.rfw + 1) + ' ' + rf + ' ' + (cx + L.rfw - 12) + ' ' + (rf + 1) +
            'Q' + cx + ' ' + (rf + 6) + ' ' + (cx - L.rfw + 12) + ' ' + (rf + 1) +
            'Q' + (cx - L.rfw - 1) + ' ' + rf + ' ' + f1(cx - L.rfw) + ' ' + f1(rf - cr) +
            'L' + f1(cx - L.rbw - 3) + ' ' + f1(rb + cr) + 'Q' + (cx - L.rbw) + ' ' + rb + ' ' + (cx - L.rbw + 16) + ' ' + rb + 'Z';
        return '<path class="o" d="' + d + '" fill="#ff4fa3" transform="translate(0 ' + L.rim + ') translate(120 0) scale(.97 1) translate(-120 0)"/>' +
            '<path class="o" d="' + d + '" fill="url(#zc-roof)"/>' +
            '<path d="M' + (cx - L.rbw + 22) + ' ' + f1(rb + 5) + 'Q' + cx + ' ' + rb + ' ' + (cx + L.rbw - 22) + ' ' + f1(rb + 5) + '" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".75"/>';
    }

    function posts(L) {
        var cx = L.cx, y0 = L.rf + L.rim - 2, y1 = L.dash + 4, x0 = L.rfw - 16, x1 = L.hbw - 2;
        function post(s) {
            return '<path class="o" d="M' + f1(cx + s * x0 - 5) + ' ' + f1(y0) + 'h10L' + f1(cx + s * x1 + 5) + ' ' + y1 + 'h-10z" fill="#2a2140"/>';
        }
        return post(-1) + post(1);
    }

    // The hood and the face (or the rear deck and the back) as one outline, with the
    // lighter top surface laid over it and a crease where the two meet.
    function body(L) {
        var cx = L.cx, d = L.dash, hf = L.hf, b = L.rbot, bw = L.bw + 4;
        var p1 = cx - L.hbw, p2 = cx + L.hbw, p3 = cx + L.hfw, p4 = cx + bw, p5 = cx - bw, p6 = cx - L.hfw;
        var path = 'M' + (p1 + 12) + ' ' + d + 'L' + (p2 - 12) + ' ' + d + 'Q' + p2 + ' ' + d + ' ' + (p2 + 4) + ' ' + (d + 6) +
            'L' + (p3 - 1) + ' ' + f1(hf - 3) + 'Q' + (p3 + 1) + ' ' + f1(hf + 1) + ' ' + f1(p3) + ' ' + f1(hf + 6) +
            'L' + f1(p4 + 1) + ' ' + f1(b - 12) + 'Q' + f1(p4) + ' ' + f1(b) + ' ' + f1(p4 - 12) + ' ' + f1(b) +
            'L' + f1(p5 + 12) + ' ' + f1(b) + 'Q' + f1(p5) + ' ' + f1(b) + ' ' + f1(p5 - 1) + ' ' + f1(b - 12) +
            'L' + f1(p6) + ' ' + f1(hf + 6) + 'Q' + (p6 - 1) + ' ' + f1(hf + 1) + ' ' + (p6 + 1) + ' ' + f1(hf - 3) +
            'L' + (p1 - 4) + ' ' + (d + 6) + 'Q' + p1 + ' ' + d + ' ' + (p1 + 12) + ' ' + d + 'Z';
        var top = 'M' + (p1 + 12) + ' ' + (d + 2) + 'L' + (p2 - 12) + ' ' + (d + 2) + 'Q' + (p2 - 1) + ' ' + (d + 2) + ' ' + (p2 + 3) + ' ' + (d + 7) +
            'L' + (p3 - 3) + ' ' + f1(hf) + 'L' + (p6 + 3) + ' ' + f1(hf) + 'L' + (p1 - 3) + ' ' + (d + 7) + 'Q' + (p1 + 1) + ' ' + (d + 2) + ' ' + (p1 + 12) + ' ' + (d + 2) + 'Z';
        return '<path class="o" d="' + path + '" fill="url(#zc-body)"/>' +
            '<path d="' + top + '" fill="url(#zc-hood)"/>' +
            '<path class="o2" d="M' + (p6 + 1) + ' ' + f1(hf) + 'L' + (p3 - 1) + ' ' + f1(hf) + '" fill="none"/>';
    }

    function tiresFor(L, id) {
        var w = 34, x = L.bw - 4;
        return tire(id + 'l', f1(L.cx - x - w / 2), L.bot - 18, w, 40) + tire(id + 'r', f1(L.cx + x - w / 2), L.bot - 18, w, 40);
    }
    function shadow(L) {
        return '<ellipse class="shadow" data-cx="120" data-cy="227" cx="120" cy="227" rx="' + f1(L.bw + 24) + '" ry="9" fill="#120c24" opacity=".45"/>';
    }
    // The dark band under the red body: the mouth up front, the undercarriage out back.
    function under(L) {
        var x0 = f1(L.cx - L.bw + 8), w = f1(2 * (L.bw - 8)), y0 = f1(L.rbot - 10);
        return '<rect class="o" x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + f1(L.bot - L.rbot + 8) + '" rx="12" fill="#2a1b40"/>';
    }

    function front(L, id) {
        var cx = L.cx, hf = L.hf, rb = L.rbot, hx = L.bw - 24, ty = f1(rb - 5), hy = f1(rb + 11);
        return '<g class="face" data-face="front">' +
            '<g class="bub-back"></g>' + shadow(L) + tiresFor(L, id) +
            '<g class="body" data-px="120" data-py="' + L.bot + '">' +
                // The dark cab behind the eyes, with just the top of the bench seat showing.
                '<rect class="o" x="44" y="' + f1(L.rf + L.rim + 2) + '" width="152" height="' + f1(L.dash - (L.rf + L.rim + 2)) + '" rx="10" fill="#231636"/>' +
                '<rect class="o2" x="52" y="' + f1(L.rf + L.rim + 8) + '" width="136" height="18" rx="8" fill="#e2b47c"/>' +
                posts(L) + roof(L) +
                // The grin and the headlights live in the dark band under the red body, with
                // the teeth hanging from its edge.
                under(L) +
                '<rect class="o" x="86" y="' + ty + '" width="68" height="23" rx="5" fill="#fff6e6"/>' +
                '<path class="detail" d="M99.6 ' + f1(+ty + 6) + 'v15M113.2 ' + f1(+ty + 6) + 'v15M126.8 ' + f1(+ty + 6) + 'v15M140.4 ' + f1(+ty + 6) + 'v15" stroke="#120c24" stroke-width="2.2"/>' +
                '<circle class="o2" cx="' + f1(cx - hx) + '" cy="' + hy + '" r="7.5" fill="#ffe680"/><circle class="o2" cx="' + f1(cx + hx) + '" cy="' + hy + '" r="7.5" fill="#ffe680"/>' +
                body(L) +
                '<g class="eyes">' + eye(86, 110, 35) + eye(154, 110, 35) + '</g>' +
                stache(hf + 11 - 154) +
            '</g>' +
            '<g class="bub-front"></g>' +
            '</g>';
    }

    function back(L, id) {
        var cx = L.cx, hf = L.hf, wy = f1(hf + 19), spokes = '';
        for (var a = 0; a < 6; a++) {
            var t = a * Math.PI / 3, x = f1(120 + Math.cos(t) * 10), y = f1(wy + Math.sin(t) * 10);
            spokes += '<path d="M120 ' + wy + 'L' + x + ' ' + y + '" stroke="#fff6e6" stroke-width="1.6"/>' +
                '<circle cx="' + x + '" cy="' + y + '" r="3.4" fill="none" stroke="#fff6e6" stroke-width="1.6"/>';
        }
        var tx = L.hfw - 20;
        return '<g class="face" data-face="back" style="display:none">' + shadow(L) + tiresFor(L, id + 'b') +
            '<g class="body" data-px="120" data-py="' + L.bot + '">' +
                stache(L.rf + 66 - 154) +
                '<g class="eyes">' + eyeBack(86, f1(L.rf + 52), 32) + eyeBack(154, f1(L.rf + 52), 32) + '</g>' +
                posts(L) + roof(L) +
                '<rect class="o" x="56" y="' + f1(L.rf + 64) + '" width="128" height="' + f1(L.dash + 6 - (L.rf + 64)) + '" rx="14" fill="#f2c992"/>' +
                '<path class="detail" d="M120 ' + f1(L.rf + 69) + 'V' + L.dash + '" stroke="#d9a86c" stroke-width="3" stroke-linecap="round"/>' +
                under(L) + body(L) +
                '<rect class="o2" x="' + f1(cx - tx - 9) + '" y="' + f1(hf + 6) + '" width="18" height="11" rx="4" fill="#ff9f1c"/><rect class="o2" x="' + f1(cx + tx - 9) + '" y="' + f1(hf + 6) + '" width="18" height="11" rx="4" fill="#ff9f1c"/>' +
                '<rect class="o" x="91" y="' + f1(hf + 2) + '" width="58" height="35" rx="10" fill="#3fc6ff"/>' +
                '<path class="detail" d="M99 ' + f1(hf + 9) + 'h16" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>' +
                '<g class="wand" data-px="120" data-py="' + wy + '"><circle class="o2" cx="120" cy="' + wy + '" r="14" fill="#2a1b4d"/>' + spokes + '</g>' +
                '<rect class="o2" x="96" y="' + (L.bot - 23) + '" width="48" height="14" rx="3" fill="#fff6e6"/>' +
                '<text class="detail" x="120" y="' + (L.bot - 12.5) + '" text-anchor="middle" font-family="Titan One, sans-serif" font-size="9" fill="#120c24">ZERBLE</text>' +
            '</g>' +
            '<g class="bub-front"></g>' +
            '</g>';
    }

    var LOOK = [0, -2], DRIVE_LOOK = [0, 0];
    var GLANCES = [[0, 0], [0, 0], [0, 0], [-9, 1], [9, 1], [-6, -6], [6, -6], [0, 6]];

    // Where the bubbles come from: up front they rise from behind the roof, and from
    // behind they blow straight out of the machine toward you, growing as they come.
    function emitters(L) {
        return {
            front: { x: [70, 170], y: [L.rb + 2, L.rb + 10], vx: [-10, 10], vy: [-28, -16], layer: 'back', grow: 1 },
            back: { x: [118, 122], y: [L.hf + 16, L.hf + 22], vx: [-24, 24], vy: [-20, 6], layer: 'front', grow: 2.4 }
        };
    }

    // ---------- motion ----------

    // The bob is a plain sine, so there's no snap at the bottom. Squash and stretch ride
    // the same wave a beat behind it. Driving adds a faster bob, a slow side-to-side
    // roll, and now and then a road bump on a soft spring.
    var MODES = {
        still: { freq: 0, amp: 0, bubbleEvery: 0, tread: 0, wand: 0, road: 0, roll: 0, bumps: 0 },
        idle: { freq: 1.3, amp: 6, bubbleEvery: 1.5, tread: 0, wand: 90, road: 0, roll: 0, bumps: 0 },
        drive: { freq: 2.4, amp: 3.5, bubbleEvery: 0.32, tread: 70, wand: 420, road: 1, roll: 1.1, bumps: 1 }
    };
    var K = {
        squash: 0.035,
        bump: 170, bumpC: 11,
        eye: 120, eyeC: 10,
        pup: 40, pupC: 6, pupGain: 0.12,
        st: 160, stC: 9, stGain: 0.00012,
        grav: 900
    };

    // One cart, drawn into host. opts.size is its width in CSS pixels, which sets how
    // thick the ink outline is (about 1.7px on screen at any size) and whether the fine
    // detail is drawn; opts.cam overrides the camera height.
    function Rig(host, opts) {
        setup();
        opts = opts || {};
        var size = opts.size || 72, L = layout(opts.cam == null ? CAMERA : opts.cam);
        var ow = clamp(1.7 / (size / 240), 4.5, 9), id = 'zc' + (++uid);
        this.emit = emitters(L);
        this.bubScale = size < 120 ? 1.8 : 1;
        host.innerHTML = '<svg class="zcart' + (size < 120 ? ' lod-low' : '') + '" viewBox="0 0 240 240" style="--ow:' + f1(ow) + '" aria-hidden="true" focusable="false">' +
            '<g class="cart">' + front(L, id) + back(L, id) + '</g></svg>';
        this.svg = host.firstElementChild;
        this.cart = this.svg.querySelector('.cart');
        this.faces = {};
        var self = this;
        [].forEach.call(this.svg.querySelectorAll('.face'), function (f) { self.faces[f.getAttribute('data-face')] = self.parts(f); });
        this.face = 'front';
        this.P = this.faces.front;

        this.phase = 0; this.freq = 0; this.amp = 0; this.roll = 0;
        this.y = 0; this.sq = 0;
        this.by = 0; this.bv = 0; this.bumpT = rand(0.4, 1.2);
        this.jy = 0; this.jv = 0;
        this.ey = 0; this.eyv = 0;
        this.ss = 0; this.ssv = 0;
        this.gx = LOOK[0]; this.gy = LOOK[1]; this.glanceT = rand(1, 3);
        this.tread = 0; this.wand = 0;
        this.bubT = rand(0.2, 1); this.bubs = [];
        this.turn = null; this.flipX = 1;
        this.t = 0;
    }

    Rig.prototype.parts = function (f) {
        function piv(el) { return el ? [+el.getAttribute('data-px'), +el.getAttribute('data-py')] : null; }
        var body = f.querySelector('.body'), st = f.querySelector('.stache'), wand = f.querySelector('.wand'), sh = f.querySelector('.shadow');
        return {
            el: f,
            body: body, bodyP: piv(body),
            eyes: f.querySelector('.eyes'),
            pupils: [].map.call(f.querySelectorAll('.pupil'), function (p, i) {
                return { el: p, r: +p.getAttribute('data-r'), x: LOOK[0], y: LOOK[1], vx: 0, vy: 0, k: K.pup * (i ? 1.1 : 0.92) };
            }),
            stache: st, stacheP: piv(st),
            wand: wand, wandP: piv(wand),
            shadow: sh, shadowC: [+sh.getAttribute('data-cx'), +sh.getAttribute('data-cy')],
            treads: [].slice.call(f.querySelectorAll('.tread')),
            bubBack: f.querySelector('.bub-back'), bubFront: f.querySelector('.bub-front')
        };
    };

    // Turn to face 'front' (coming down the page) or 'back' (heading up it). He squashes
    // to a sliver, swaps sides, and springs back out with a little hop. instant skips all
    // of that (for reduced motion, or a cart that should start out facing away).
    Rig.prototype.turnTo = function (facing, instant) {
        if (instant) {
            this.turn = null; this.flipX = 1;
            if (this.face !== facing) this.swap(facing);
            return;
        }
        if (this.face !== facing || this.turn) this.turn = { t: 0, to: facing, swapped: false };
        this.jv = -110;
    };

    Rig.prototype.swap = function (facing) {
        this.P.el.style.display = 'none';
        this.face = facing;
        this.P = this.faces[facing];
        this.P.el.style.display = '';
        this.clearBubbles();
    };

    Rig.prototype.integrate = function (h, M) {
        var ease = Math.min(1, h * 3);
        this.amp += (M.amp - this.amp) * ease;
        this.freq += (M.freq - this.freq) * ease;
        this.roll += (M.roll - this.roll) * ease;
        this.phase = (this.phase + h * this.freq) % 1;
        var w = 2 * Math.PI * this.phase;
        var bob = -this.amp * (1 - Math.cos(w)) / 2;

        // Road bumps (driving) and the hop when he turns around both land on the bump spring.
        this.bv += (-K.bump * this.by - K.bumpC * this.bv) * h; this.by += this.bv * h;
        if (this.jv !== 0 || this.jy !== 0) {
            this.jv += K.grav * h; this.jy += this.jv * h;
            if (this.jy >= 0) { this.jy = 0; this.jv = 0; this.bv += 70; }
        }

        this.y = bob + this.jy + this.by;
        this.sq = (this.amp / 6) * K.squash * Math.cos(w - 0.5) + this.by * 0.012;

        // The eyes ride a spring behind the body, so they bob a beat late.
        var ea = K.eye * (this.y - this.ey) - K.eyeC * this.eyv;
        this.eyv += ea * h; this.ey += this.eyv * h;

        // Loose irises: they trail the eye's motion and bounce off the rim.
        var P = this.P;
        for (var i = 0; i < P.pupils.length; i++) {
            var p = P.pupils[i];
            var ax = -p.k * (p.x - this.gx) - K.pupC * p.vx;
            var ay = -p.k * (p.y - this.gy) - K.pupC * p.vy - ea * K.pupGain;
            p.vx += ax * h; p.vy += ay * h; p.x += p.vx * h; p.y += p.vy * h;
            var d = Math.hypot(p.x, p.y);
            if (d > p.r) {
                var nx = p.x / d, ny = p.y / d, vr = p.vx * nx + p.vy * ny;
                p.x = nx * p.r; p.y = ny * p.r;
                if (vr > 0) { p.vx -= 1.4 * vr * nx; p.vy -= 1.4 * vr * ny; }
            }
        }

        this.ssv += (-K.st * this.ss - K.stC * this.ssv - ea * K.stGain * 60) * h; this.ss += this.ssv * h;
    };

    // Advance dt seconds in a mode ('still', 'idle' or 'drive') and redraw.
    Rig.prototype.update = function (dt, mode) {
        var M = MODES[mode];
        this.t += dt;

        if (this.turn) {
            this.turn.t += dt / 0.42;
            if (this.turn.t >= 0.5 && !this.turn.swapped) { this.turn.swapped = true; this.swap(this.turn.to); }
            var t = Math.min(1, this.turn.t);
            if (t < 0.5) { var a = t * 2; this.flipX = 1 - a * a; }
            else { var b = (t - 0.5) * 2 - 1; this.flipX = 1 + 2.4 * b * b * b + 1.4 * b * b; }
            if (this.turn.t >= 1) { this.turn = null; this.flipX = 1; }
        }

        if (M.bumps) {
            this.bumpT -= dt;
            if (this.bumpT <= 0) { this.bv += rand(25, 60); this.bumpT = rand(0.5, 1.5); }
        }

        // Idle glances: mostly at you, now and then off to a side.
        this.glanceT -= dt;
        var look = mode === 'drive' ? DRIVE_LOOK : LOOK;
        if (mode !== 'idle') { this.gx = look[0]; this.gy = look[1]; }
        else if (this.glanceT <= 0) {
            var g = GLANCES[Math.floor(Math.random() * GLANCES.length)];
            this.gx = look[0] + g[0]; this.gy = look[1] + g[1];
            this.glanceT = rand(1.6, 4.2);
        }

        var steps = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / steps;
        for (var i = 0; i < steps; i++) this.integrate(h, M);

        this.tread = (this.tread + dt * M.tread) % 8;
        this.wand = (this.wand + dt * M.wand) % 360;
        this.render();
        this.bubbles(dt, M);
    };

    function about(p, sx, sy) { return 'translate(' + p[0] + ' ' + p[1] + ') scale(' + sx.toFixed(4) + ' ' + sy.toFixed(4) + ') translate(' + -p[0] + ' ' + -p[1] + ')'; }

    Rig.prototype.render = function () {
        var P = this.P, sx = 1 + this.sq * 0.8, sy = 1 - this.sq;
        var roll = Math.sin(this.t * 2.3) * this.roll;
        P.body.setAttribute('transform', 'translate(0 ' + this.y.toFixed(2) + ') rotate(' + roll.toFixed(2) + ' ' + P.bodyP[0] + ' ' + P.bodyP[1] + ') ' + about(P.bodyP, sx, sy));
        if (P.eyes) P.eyes.setAttribute('transform', 'translate(0 ' + clamp(this.ey - this.y, -6, 6).toFixed(2) + ')');
        for (var i = 0; i < P.pupils.length; i++) P.pupils[i].el.setAttribute('transform', 'translate(' + P.pupils[i].x.toFixed(2) + ' ' + P.pupils[i].y.toFixed(2) + ')');
        if (P.stache) {
            var ss = clamp(this.ss, -0.08, 0.08);
            P.stache.setAttribute('transform', about(P.stacheP, 1 + ss * 0.6, 1 - ss));
        }
        if (P.wand) P.wand.setAttribute('transform', 'rotate(' + this.wand.toFixed(1) + ' ' + P.wandP[0] + ' ' + P.wandP[1] + ')');
        var hgt = clamp(-this.y / 8, 0, 1.6);
        P.shadow.setAttribute('transform', about(P.shadowC, 1 - 0.14 * hgt, 1));
        P.shadow.setAttribute('opacity', (0.45 - 0.12 * hgt).toFixed(3));
        for (var j = 0; j < P.treads.length; j++) P.treads[j].setAttribute('transform', 'translate(0 ' + this.tread.toFixed(2) + ')');
        this.cart.setAttribute('transform', this.flipX !== 1 ? 'translate(120 0) scale(' + this.flipX.toFixed(4) + ' 1) translate(-120 0)' : '');
    };

    // Bubbles out of the bubble machine. They live inside the SVG (which doesn't clip),
    // so they drift out past the cart, and pop at the end of their life.
    Rig.prototype.bubbles = function (dt, M) {
        var spec = this.emit[this.face];
        if (spec && M.bubbleEvery) {
            this.bubT -= dt;
            if (this.bubT <= 0) {
                this.bubT = M.bubbleEvery * rand(0.6, 1.4);
                var layer = spec.layer === 'front' ? this.P.bubFront : this.P.bubBack;
                var el = document.createElementNS(SVGNS, 'g');
                el.innerHTML = '<circle r="1" fill="url(#zc-bubfill)" stroke="url(#zc-bub)" stroke-width=".13" stroke-opacity=".85"/>' +
                    '<circle cx="-.38" cy="-.4" r=".18" fill="#ffffff" opacity=".85"/>';
                layer.appendChild(el);
                var fast = M.road ? 1.6 : 1;
                this.bubs.push({
                    el: el, x: rand(spec.x[0], spec.x[1]), y: rand(spec.y[0], spec.y[1]),
                    vx: rand(spec.vx[0], spec.vx[1]), vy: rand(spec.vy[0], spec.vy[1]) * fast,
                    r: rand(5, 10) * this.bubScale, grow: spec.grow, age: 0, life: rand(2.2, 3.8), seed: Math.random() * 6
                });
            }
        }
        for (var i = this.bubs.length - 1; i >= 0; i--) {
            var b = this.bubs[i];
            b.age += dt;
            b.x += (b.vx + Math.sin(b.age * 2.4 + b.seed) * 7) * dt;
            b.y += b.vy * dt;
            var life = b.age / b.life, r = b.r * (0.5 + 0.5 * Math.min(1, b.age * 4)) * (1 + (b.grow - 1) * life), op = 1;
            if (life > 1) { var pop = (b.age - b.life) / 0.12; r *= 1 + pop * 0.5; op = 1 - pop; }
            if (op <= 0) { b.el.remove(); this.bubs.splice(i, 1); continue; }
            b.el.setAttribute('transform', 'translate(' + b.x.toFixed(1) + ' ' + b.y.toFixed(1) + ') scale(' + r.toFixed(2) + ')');
            b.el.setAttribute('opacity', op.toFixed(2));
        }
    };

    Rig.prototype.clearBubbles = function () {
        this.bubs.forEach(function (b) { b.el.remove(); });
        this.bubs = [];
    };

    window.ZerbleCart = { Rig: Rig, layout: layout, MODES: MODES, K: K, CAMERA: CAMERA };

    // ---------- on the page: riding the story road ----------

    // The cart sits in an extra <li> laid over the timeline, and styles.css makes the car
    // inside it sticky, so it waits at the start of the road, rides along in the middle
    // of the screen while the story scrolls past, and parks at the end of its track.
    var timeline = document.querySelector('.timeline');
    if (!timeline || !('IntersectionObserver' in window)) return;

    var lastMoment = timeline.lastElementChild;
    var track = document.createElement('li');
    track.className = 'road-cart';
    track.setAttribute('aria-hidden', 'true');
    track.innerHTML = '<div class="road-cart-car"></div>';
    timeline.appendChild(track);
    var car = track.firstChild;

    // The track stops where the last moment (the "up next" card) starts, so he parks on
    // the road just above it, waiting for the next stop. Photos loading in can change
    // that card's height, so keep it fitted.
    function fitTrack() { track.style.bottom = (lastMoment.offsetHeight + 10) + 'px'; }
    if (lastMoment) {
        fitTrack();
        if ('ResizeObserver' in window) new ResizeObserver(fitTrack).observe(lastMoment);
    }

    var phone = window.matchMedia('(max-width: 860px)');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var rig = null, facing = 'front';

    // Built at the size styles.css gives the car, so it's rebuilt when that changes.
    function build() {
        if (rig) rig.clearBubbles();
        rig = new Rig(car, { size: car.offsetWidth });
        rig.turnTo(facing, true);
        rig.update(0, reduce.matches ? 'still' : 'idle');
    }
    function onChange(mq, fn) {
        if (mq.addEventListener) mq.addEventListener('change', fn); else mq.addListener(fn);
    }
    onChange(phone, build);
    onChange(reduce, build);
    build();

    // He drives while he's actually moving along the road, which is how far the car sits
    // from the top of its track, not how far the page scrolled. Parked at either end, he
    // idles even while the page keeps scrolling.
    var raf = 0, last = 0, lastPos = null, speed = 0, stopped = 0, push = 0, mode = 'idle';
    function frame(now) {
        raf = requestAnimationFrame(frame);
        var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        var pos = car.getBoundingClientRect().top - track.getBoundingClientRect().top;
        if (lastPos !== null && dt > 0) {
            var d = pos - lastPos;
            speed += (Math.abs(d) / dt - speed) * Math.min(1, dt * 10);
            // Turn around only once he's really been heading the other way for a bit, so
            // a jiggle or an overscroll bounce doesn't spin him back and forth.
            if (d !== 0) {
                if ((d > 0) === (facing === 'front')) push = 0;
                else if ((push += Math.abs(d)) > 24) {
                    facing = facing === 'front' ? 'back' : 'front';
                    push = 0;
                    rig.turnTo(facing, reduce.matches);
                }
            }
        }
        lastPos = pos;
        if (speed > 30) { mode = 'drive'; stopped = 0; }
        else if ((stopped += dt) > 0.3) mode = 'idle';
        rig.update(dt, reduce.matches ? 'still' : mode);
    }

    // Only run while the road is on screen.
    new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
            if (!raf) { last = 0; lastPos = null; raf = requestAnimationFrame(frame); }
        } else if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
    }, { rootMargin: '200px 0px' }).observe(track);
})();
