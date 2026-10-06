/* zerble.net — wordmark pop.
   Ported from the RADish Fest hero: the letter nearest the cursor pops up
   (lift + counter-tilt + scale + deeper shadow, on a springy overshoot curve),
   and a one-time intro sweep plays the effect for visitors who never hover,
   which includes everyone on a phone. Zerble's twist: every pop puffs a bubble.
   All of the motion lives in styles.css under .wordmark .ltr.is-hot. */
(function () {
    'use strict';

    var h1 = document.querySelector('.wordmark');
    if (!h1) return;
    var letters = [].slice.call(h1.querySelectorAll('.ltr'));
    if (!letters.length) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var active = null;

    function puff(el) {
        if (reduceMotion) return;
        var b = document.createElement('span');
        b.className = 'pop';
        b.setAttribute('aria-hidden', 'true');
        b.style.setProperty('--drift', Math.round(Math.random() * 24 - 12) + 'px');
        b.addEventListener('animationend', function () { b.remove(); });
        el.appendChild(b);
    }

    function setHot(el) {
        el.classList.add('is-hot');
        puff(el);
    }

    function reset(el) {
        el.classList.remove('is-hot');
    }

    function activate(el) {
        if (active === el) return;
        if (active) reset(active);
        setHot(el);
        active = el;
    }

    function release() {
        if (active) reset(active);
        active = null;
    }

    function nearest(x) {
        var best = null, bestD = Infinity;
        letters.forEach(function (el) {
            var r = el.getBoundingClientRect();
            var d = Math.abs((r.left + r.right) / 2 - x);
            if (d < bestD) { bestD = d; best = el; }
        });
        return best;
    }

    // Cancel a running intro sweep the moment the visitor takes over.
    var introTimers = [];
    function stopIntro() {
        if (!introTimers.length) return;
        introTimers.forEach(clearTimeout);
        introTimers = [];
        letters.forEach(reset);
        active = null;
    }

    h1.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        stopIntro();
        activate(nearest(e.clientX));
    });
    h1.addEventListener('pointerleave', function (e) {
        if (e.pointerType === 'touch') return;
        stopIntro();
        release();
    });

    // Touch has no hover, so a tap pops the nearest letter and lets it settle back.
    var tapTimer = null;
    h1.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'touch') return;
        stopIntro();
        clearTimeout(tapTimer);
        active = null;
        activate(nearest(e.clientX));
        tapTimer = setTimeout(release, 650);
    });

    // Intro sweep, in two beats: Z-E-R-B-L-E light up one at a time, then all six
    // bloom back in on shuffled, jittered offsets and hold together before releasing.
    var INTRO_DELAY  = 700;   // pause before the sweep starts (ms)
    var SWEEP_STEP   = 140;   // beat 1: gap between one letter and the next (ms)
    var BLOOM_GAP    = 200;   // pause between the beats (ms)
    var BLOOM_STAGGER = 70;   // beat 2: base spacing between letter starts (ms)
    var BLOOM_JITTER = 90;    // beat 2: random wobble added to each start (ms)
    var BLOOM_HOLD   = 420;   // beat 2: how long all six stay lit together (ms)
    var BLOOM_OUT    = 260;   // beat 2: random stagger on the release (ms)

    function run() {
        letters.forEach(function (el, i) {
            introTimers.push(setTimeout(function () { activate(el); }, i * SWEEP_STEP));
        });

        var bloomStart = (letters.length - 1) * SWEEP_STEP + BLOOM_GAP;
        introTimers.push(setTimeout(release, bloomStart));

        var slots = letters.map(function (_, i) { return i; });
        for (var s = slots.length - 1; s > 0; s--) {     // Fisher-Yates shuffle
            var j = Math.floor(Math.random() * (s + 1));
            var tmp = slots[s]; slots[s] = slots[j]; slots[j] = tmp;
        }
        var starts = letters.map(function (_, i) {
            return slots[i] * BLOOM_STAGGER + Math.round(Math.random() * BLOOM_JITTER);
        });
        letters.forEach(function (el, i) {
            introTimers.push(setTimeout(function () { setHot(el); }, bloomStart + starts[i]));
        });

        var releaseAt = bloomStart + Math.max.apply(null, starts) + BLOOM_HOLD;
        letters.forEach(function (el) {
            introTimers.push(setTimeout(function () { reset(el); }, releaseAt + Math.round(Math.random() * BLOOM_OUT)));
        });
        introTimers.push(setTimeout(function () {
            active = null;
            introTimers = [];
        }, releaseAt + BLOOM_OUT + 80));
    }

    // If the tab loads in the background, hold the one-shot sweep until it's visible.
    function start() {
        if (document.visibilityState === 'hidden') {
            document.addEventListener('visibilitychange', function onVis() {
                if (document.visibilityState !== 'visible') return;
                document.removeEventListener('visibilitychange', onVis);
                run();
            });
        } else {
            run();
        }
    }

    if (!reduceMotion) introTimers.push(setTimeout(start, INTRO_DELAY));
})();

/* The bubble pump (the tip jar). Picking an amount ticks the screen over like a
   gas pump, fills the jugs, and points the tip links at that amount. The $10
   default is baked into the HTML, so the links still work if this never runs. */
(function () {
    'use strict';

    var pump = document.querySelector('.pump');
    if (!pump) return;

    var PRICE = parseFloat(pump.getAttribute('data-price')) || 22.5;   // dollars per gallon of juice
    var NOTE = 'Bubble juice for Zerble';
    var TICK = 700;   // ms for the screen to tick over; matches the jug fill transition in styles.css

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sale = pump.querySelector('[data-pump="sale"]');
    var gallons = pump.querySelector('[data-pump="gallons"]');
    var summary = pump.querySelector('[data-pump="summary"]');
    var jugs = [].slice.call(pump.querySelectorAll('.jug > span'));
    var amts = [].slice.call(pump.querySelectorAll('.amt'));
    var links = [].slice.call(pump.querySelectorAll('[data-pay]'));
    var shown = 0;
    var raf = 0;

    // Strip the baked-in amount so each link keeps just its account URL.
    links.forEach(function (a) {
        a.setAttribute('data-base', a.href.split('?')[0].replace(/\/\d+(\.\d+)?USD$/, ''));
    });

    function screen(amt) {
        sale.textContent = '$' + amt.toFixed(2);
        gallons.textContent = (amt / PRICE).toFixed(3);
    }

    // One box is four gallon jugs, so the gallons pour into the jugs left to right.
    function fill(amt) {
        var gal = amt / PRICE;
        jugs.forEach(function (jug, i) {
            jug.style.setProperty('--fill', Math.max(0, Math.min(1, gal - i)).toFixed(3));
        });
    }

    function tick(to) {
        cancelAnimationFrame(raf);
        if (reduceMotion || document.hidden) {
            shown = to;
            screen(to);
            return;
        }
        var from = shown, t0 = null;
        raf = requestAnimationFrame(function step(t) {
            if (t0 === null) t0 = t;
            var k = Math.min(1, (t - t0) / TICK);
            shown = from + (to - from) * (1 - Math.pow(1 - k, 3));   // eases out, like a pump slowing at the end
            screen(shown);
            if (k < 1) raf = requestAnimationFrame(step);
        });
    }

    function point(amt) {
        links.forEach(function (a) {
            var base = a.getAttribute('data-base');
            a.href = a.getAttribute('data-pay') === 'venmo'
                ? base + '?txn=pay&amount=' + amt + '&note=' + encodeURIComponent(NOTE)
                : base + '/' + amt + 'USD';   // PayPal.me, for when that button comes back (see README)
            a.setAttribute('data-ga-amount', amt);
        });
        amts.forEach(function (s) { s.textContent = '$' + amt; });
    }

    // The live region only changes when the words do, so screen readers don't repeat themselves.
    function say(amt) {
        var text = '$' + amt + ' buys about ' + (amt / PRICE).toFixed(1) + ' gallons of bubble juice.';
        if (summary.textContent !== text) summary.textContent = text;
    }

    function current() {
        var checked = pump.querySelector('input[name="tip"]:checked');
        return checked ? parseFloat(checked.value) : 10;
    }

    pump.addEventListener('change', function (e) {
        if (e.target.name !== 'tip') return;
        var amt = parseFloat(e.target.value);
        point(amt);
        fill(amt);
        tick(amt);
        say(amt);
    });

    // Browsers can restore a different pick on Back, so sync to whatever is checked.
    var start = current();
    point(start);
    say(start);
    if (reduceMotion || document.hidden || !('IntersectionObserver' in window)) {
        shown = start;
        screen(start);
        fill(start);
        return;
    }

    // First look: the pump sits at zero and ticks up once it scrolls into view.
    screen(0);
    fill(0);
    var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        var amt = current();
        fill(amt);
        tick(amt);
    }, { threshold: 0.5 });
    io.observe(pump);
})();
