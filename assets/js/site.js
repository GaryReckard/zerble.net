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
