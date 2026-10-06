/* zerble.net — wordmark pop.
   Ported from the RADish Fest hero: the letter nearest the cursor pops up
   (lift + counter-tilt + scale + deeper shadow, on a springy overshoot curve),
   and a one-time intro sweep plays the effect for visitors who never hover,
   which includes everyone on a phone. Zerble's twist: every pop puffs a bubble.
   After the intro, a softer and slower wave keeps rippling across every few
   seconds. All of the motion lives in styles.css under .is-hot and .is-wave. */
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

    // Idle wave: once the intro is over, a gentler ripple runs left to right, rests,
    // and repeats, but only while the wordmark is on screen and nobody is hovering it.
    var WAVE_STEP   = 170;    // gap between one letter and the next (ms)
    var WAVE_HOLD   = 550;    // how long each letter rises before easing back down (ms)
    var WAVE_SETTLE = 900;    // the slow ease back down; matches .is-waving in styles.css (ms)
    var WAVE_PAUSE  = 2000;   // rest between waves (ms)

    var waveTimers = [];
    var looping = false;      // flips on when the intro ends or the visitor interrupts it
    var hovering = false;
    var onScreen = true;

    function stopWave() {
        if (!waveTimers.length && !h1.classList.contains('is-waving')) return;
        waveTimers.forEach(clearTimeout);
        waveTimers = [];
        letters.forEach(function (el) { el.classList.remove('is-wave'); });
        h1.classList.remove('is-waving');
    }

    function scheduleWave(delay) {
        stopWave();
        if (reduceMotion || !looping || hovering || !onScreen || document.hidden) return;
        waveTimers.push(setTimeout(wave, delay));
    }

    function wave() {
        h1.classList.add('is-waving');
        letters.forEach(function (el, i) {
            waveTimers.push(setTimeout(function () { el.classList.add('is-wave'); }, i * WAVE_STEP));
            waveTimers.push(setTimeout(function () { el.classList.remove('is-wave'); }, i * WAVE_STEP + WAVE_HOLD));
        });
        waveTimers.push(setTimeout(function () {
            h1.classList.remove('is-waving');
            scheduleWave(WAVE_PAUSE);
        }, (letters.length - 1) * WAVE_STEP + WAVE_HOLD + WAVE_SETTLE));
    }

    // Cancel a running intro sweep the moment the visitor takes over.
    var introTimers = [];
    function stopIntro() {
        looping = true;
        if (!introTimers.length) return;
        introTimers.forEach(clearTimeout);
        introTimers = [];
        letters.forEach(reset);
        active = null;
    }

    h1.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        hovering = true;
        stopWave();
    });
    h1.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        stopIntro();
        activate(nearest(e.clientX));
    });
    h1.addEventListener('pointerleave', function (e) {
        if (e.pointerType === 'touch') return;
        hovering = false;
        stopIntro();
        release();
        scheduleWave(WAVE_PAUSE);
    });

    // Touch has no hover, so a tap pops the nearest letter and lets it settle back.
    var tapTimer = null;
    h1.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'touch') return;
        stopIntro();
        stopWave();
        clearTimeout(tapTimer);
        active = null;
        activate(nearest(e.clientX));
        tapTimer = setTimeout(function () {
            release();
            scheduleWave(WAVE_PAUSE);
        }, 650);
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
            looping = true;
            scheduleWave(WAVE_PAUSE);
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

    // Rest the wave while the tab is in the background or the hero is scrolled away.
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopWave();
        else scheduleWave(WAVE_PAUSE);
    });
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            onScreen = entries[0].isIntersecting;
            if (onScreen) scheduleWave(800);
            else stopWave();
        }).observe(h1);
    }
})();

/* The hero parallax. The hero art is three stacked layers, and styles.css gives each
   one its own depth. This only feeds the stack two inputs: which way you're looking
   at it (--mx and --my, -1 to 1, eased so the layers drift instead of snapping) and
   how far the hero has scrolled (--sy). A mouse steers the first by hovering over the
   hero, and a phone steers it by tilting. Reduced motion gets none of it. */
(function () {
    'use strict';

    var stack = document.querySelector('.hero-art');
    var hero = stack && stack.closest('.hero');
    if (!hero) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var EASE = 0.07;            // share of the remaining distance the layers cover each frame
    var TILT_RANGE = 18;        // degrees of phone tilt for the full swing
    var TILT_SETTLE = 2500;     // ms for a held tilt to become the new resting angle
    var tx = 0, ty = 0, x = 0, y = 0;
    var raf = 0;
    var onScreen = true;
    var chip = stack.querySelector('.tilt-chip');
    var rest = null;            // the angle the phone is being held at, in screen axes
    var tilting = false;

    function clamp(v) { return Math.max(-1, Math.min(1, v)); }

    function frame() {
        raf = 0;
        x += (tx - x) * EASE;
        y += (ty - y) * EASE;
        if (Math.abs(tx - x) < 0.002) x = tx;
        if (Math.abs(ty - y) < 0.002) y = ty;
        stack.style.setProperty('--mx', x.toFixed(3));
        stack.style.setProperty('--my', y.toFixed(3));
        stack.style.setProperty('--sy', Math.round(Math.max(0, -hero.getBoundingClientRect().top)));
        if (x !== tx || y !== ty) kick();
    }

    function kick() {
        if (!raf && onScreen) raf = requestAnimationFrame(frame);
    }

    // Measured from the middle of the art, against half the hero, so the mouse can
    // steer it from anywhere in the hero and reaches the full swing near the edges.
    hero.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var art = stack.getBoundingClientRect();
        var box = hero.getBoundingClientRect();
        tx = clamp((e.clientX - (art.left + art.width / 2)) / (box.width / 2));
        ty = clamp((e.clientY - (art.top + art.height / 2)) / (box.height / 2));
        kick();
    });
    hero.addEventListener('pointerleave', function (e) {
        if (e.pointerType === 'touch') return;   // fires on every lifted finger, and tilt owns the target there
        tx = ty = 0;
        kick();
    });

    function screenAngle() {
        var a = screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : window.orientation || 0;
        return ((a % 360) + 360) % 360;
    }

    function onTilt(e) {
        if (e.beta == null || e.gamma == null) return;   // desktops send one empty reading
        // Turn the phone's own axes into screen axes, whichever way up it's being held.
        var a = screenAngle();
        var h = a === 90 ? e.beta : a === 270 ? -e.beta : a === 180 ? -e.gamma : e.gamma;
        var v = a === 90 ? -e.gamma : a === 270 ? e.gamma : a === 180 ? -e.beta : e.beta;
        if (!rest || rest.a !== a) rest = { h: h, v: v, a: a, t: e.timeStamp };
        // Ease the resting angle toward however the phone is held, so a slouch or a lean
        // only shows as motion while it's happening and then settles back to center.
        var k = 1 - Math.exp(-Math.max(0, e.timeStamp - rest.t) / TILT_SETTLE);
        rest.h += (h - rest.h) * k;
        rest.v += (v - rest.v) * k;
        rest.t = e.timeStamp;
        // Tipping one edge of the phone away is like stepping toward the other side of
        // the cart, so the far bubbles swing toward the edge that came closer.
        tx = clamp(-(h - rest.h) / TILT_RANGE);
        ty = clamp(-(v - rest.v) / TILT_RANGE);
        if (!tilting) {
            tilting = true;
            if (chip) chip.hidden = true;
        }
        kick();
    }

    window.addEventListener('deviceorientation', onTilt);

    // iOS sends no readings until someone taps and allows motion access. If nothing has
    // arrived shortly after load (it can, when they already allowed it this visit), offer
    // the chip, whose tap is the one that's allowed to ask.
    var DOE = window.DeviceOrientationEvent;
    if (chip && DOE && typeof DOE.requestPermission === 'function' && window.matchMedia('(pointer: coarse)').matches) {
        setTimeout(function () { if (!tilting) chip.hidden = false; }, 700);
        chip.addEventListener('click', function () {
            chip.hidden = true;
            DOE.requestPermission().then(function (state) {
                if (state === 'granted') window.addEventListener('deviceorientation', onTilt);
            }).catch(function () {});
        });
    }
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            onScreen = entries[0].isIntersecting;
            kick();
        }).observe(hero);
    }
    kick();
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

/* Bubble popping, a tiny mini-game. The floating bubbles stay pointer-events: none,
   so they never get between anyone and a link, a button, or the page. Instead, a
   click or tap on plain background or text checks whether a bubble sits under it,
   and pops that one. A popped bubble comes back on its next trip up from the bottom. */
(function () {
    'use strict';

    var layer = document.querySelector('.bubbles');
    if (!layer || getComputedStyle(layer).display === 'none') return;   // reduced motion hides them
    var bubbles = [].slice.call(layer.querySelectorAll('span'));

    // Anything interactive, or solid enough that a bubble behind it can't be seen.
    var SKIP = 'a, button, input, select, textarea, label, summary, img, video, .wordmark, .announce, .pump, .book-card, .pass, .snap, .coin';
    var COLORS = ['var(--sky)', 'var(--pink)', 'var(--sun)', 'var(--leaf)', 'var(--grape)'];
    var MILESTONES = [1, 10, 25, 50, 100];   // pop counts worth a GA event
    var popped = 0;

    bubbles.forEach(function (b) {
        b.addEventListener('animationiteration', function () { b.style.visibility = ''; });
    });

    function pop(b, r) {
        var size = r.width;
        var fx = document.createElement('div');
        fx.className = 'bubble-pop';
        fx.style.left = (r.left + size / 2) + 'px';
        fx.style.top = (r.top + size / 2) + 'px';
        fx.style.setProperty('--s', size + 'px');
        for (var i = 0; i < 6; i++) {
            var drop = document.createElement('i');
            drop.style.setProperty('--a', (i * 60 + Math.round(Math.random() * 30)) + 'deg');
            drop.style.setProperty('--c', COLORS[(i + popped) % COLORS.length]);
            fx.appendChild(drop);
        }
        var count = document.createElement('b');
        count.textContent = ++popped;
        fx.appendChild(count);
        layer.appendChild(fx);
        setTimeout(function () { fx.remove(); }, 1000);
        b.style.visibility = 'hidden';

        if (MILESTONES.indexOf(popped) !== -1 && typeof window.gtag === 'function') {
            window.gtag('event', 'bubble_pop', { popped: popped, page: location.pathname });
        }
    }

    // click (not pointerdown) so a finger that starts a scroll never pops anything.
    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest(SKIP)) return;
        var sel = window.getSelection && window.getSelection();
        if (sel && !sel.isCollapsed) return;   // they were selecting text, not popping

        for (var i = 0; i < bubbles.length; i++) {
            var b = bubbles[i];
            if (b.style.visibility === 'hidden') continue;
            var r = b.getBoundingClientRect();
            var rad = r.width / 2;
            var reach = Math.max(rad + 6, 22);   // small bubbles get a fingertip-sized target
            var dx = e.clientX - (r.left + rad);
            var dy = e.clientY - (r.top + rad);
            if (dx * dx + dy * dy <= reach * reach) {
                pop(b, r);
                return;
            }
        }
    });
})();
