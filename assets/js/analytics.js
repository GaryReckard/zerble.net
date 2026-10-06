/* zerble.net — GA4 event tracking (ported from RADish Fest).
   Pairs with the host-gated gtag snippet in <head>. Sends three custom event types:
     1. clicks        — every link/button, auto-named by destination type
     2. scroll_depth  — 25 / 50 / 75 / 90 / 100% milestones (once each)
     3. section_view  — fires when a <section data-screen-label> scrolls into view

   The two money CTAs (play, instagram) carry data-ga="..." for clean naming.
   On local dev the gtag snippet never loads, so everything here quietly no-ops. */
(function () {
    'use strict';

    function ev(name, params) {
        params = params || {};
        params.page = location.pathname;
        if (typeof window.gtag === 'function') {
            window.gtag('event', name, params);
        } else if (Array.isArray(window.dataLayer)) {
            params.event = name;
            window.dataLayer.push(params);
        }
    }

    /* 1. Click tracking ---------------------------------------------------- */
    document.addEventListener('click', function (e) {
        var el = e.target.closest('a, button, [data-ga]');
        if (!el) return;

        var href = el.getAttribute('href') || '';
        var label = el.getAttribute('data-ga')
            || el.getAttribute('aria-label')
            || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80)
            || href;

        var name = 'cta_click';
        if (href.indexOf('mailto:') === 0) name = 'email_click';
        else if (/^https?:\/\//i.test(href) && href.indexOf(location.host) === -1) name = 'outbound_click';
        else if (href.indexOf('#') === 0) name = 'anchor_click';

        ev(name, {
            link_text: label,
            link_url: href || undefined,
            link_id: el.id || undefined
        });
    }, true); // capture phase: fires even if a handler calls stopPropagation

    /* 2. Scroll depth ------------------------------------------------------ */
    var marks = [25, 50, 75, 90, 100];
    var hit = {};

    function checkScroll() {
        var doc = document.documentElement;
        var scrollable = doc.scrollHeight - window.innerHeight;
        if (scrollable <= 0) return;
        var pct = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
        marks.forEach(function (m) {
            if (pct >= m && !hit[m]) {
                hit[m] = true;
                ev('scroll_depth', { percent: m });
            }
        });
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
            checkScroll();
            ticking = false;
        });
    }, { passive: true });
    window.addEventListener('load', checkScroll);

    /* 3. Section visibility ------------------------------------------------ */
    if ('IntersectionObserver' in window) {
        var seen = {};
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                var label = en.target.getAttribute('data-screen-label') || en.target.id;
                if (!label || seen[label]) return;
                seen[label] = true;
                ev('section_view', { section: label });
            });
        }, { threshold: 0.4 });
        document.querySelectorAll('[data-screen-label]').forEach(function (s) {
            io.observe(s);
        });
    }
})();
