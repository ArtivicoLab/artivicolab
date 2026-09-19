/**
 * ArtivicoLab entry notice
 * First visit only: shows a rights notice the visitor must acknowledge
 * before using the site. Remembered in localStorage so it never repeats.
 */
(function () {
    'use strict';

    var KEY = 'artivicolab_gate_ack_v1';

    function acked() {
        try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
    }
    function remember() {
        try { localStorage.setItem(KEY, '1'); } catch (e) { /* private mode, fine */ }
    }

    function build() {
        var overlay = document.createElement('div');
        overlay.className = 'gate';
        overlay.innerHTML =
            '<div class="gate-card" role="dialog" aria-modal="true" aria-labelledby="gate-title" aria-describedby="gate-body">' +
                '<svg class="gate-watermark" viewBox="0 0 32 40" aria-hidden="true" focusable="false">' +
                    '<path class="gate-wm-shackle" d="M9,18 C8,7 11,3 16,3 C21,3 24,7 23,18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
                    '<path d="M5,18 C12,17 20,17 27,18 C28,25 27,31 27,36 C20,37 12,37 5,36 C5,31 4,25 5,18 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
                    '<circle cx="16" cy="26" r="2.2" fill="currentColor"/>' +
                    '<path d="M16,28 L16,32" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
                '</svg>' +
                '<p class="eyebrow">Notice &middot; before you enter</p>' +
                '<h2 id="gate-title" class="gate-title">All rights reserved.</h2>' +
                '<p id="gate-body" class="gate-body">Everything on this site is the original work of <strong>Gradi Kayamba</strong>, published under <strong>ArtivicoLab</strong> supervision. Gradi\'s imagination, brought to life. Look around, use the apps, fork the templates that say you can. Just don\'t pass any of it off as your own.</p>' +
                '<div class="gate-cta">' +
                    '<button type="button" class="gate-btn" id="gate-btn">' +
                        '<svg class="gate-lock" viewBox="0 0 32 40" aria-hidden="true" focusable="false">' +
                            '<path class="gate-lock-shackle" d="M9,18 C8,7 11,3 16,3 C21,3 24,7 23,18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
                            '<path class="gate-lock-body" d="M5,18 C12,17 20,17 27,18 C28,25 27,31 27,36 C20,37 12,37 5,36 C5,31 4,25 5,18 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
                            '<circle class="gate-lock-key" cx="16" cy="26" r="2.2" fill="currentColor"/>' +
                            '<path class="gate-lock-key" d="M16,28 L16,32" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
                        '</svg>' +
                        '<span class="gate-btn-text">Understood, chef Gradi.</span>' +
                    '</button>' +
                    '<svg class="gate-arrow" viewBox="0 0 120 60" aria-hidden="true" focusable="false">' +
                        '<path d="M112,10 C95,8 70,14 48,30 C36,39 26,44 12,46" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
                        '<path d="M26,36 C20,41 16,44 11,46 C16,47 21,50 25,54" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
                    '</svg>' +
                    '<span class="gate-hint">click here</span>' +
                '</div>' +
                '<p class="gate-fine">Shown once. Clicking means you read it. This site uses Google Analytics for visit counts, see <a href="privacy.html?peek=1" class="gate-link" target="_blank" rel="noopener">Privacy</a>.</p>' +
                '<p class="gate-fine gate-stamp">Site updated &middot; September 19, 2026 · 2:58 AM MDT</p>' +
            '</div>';
        return overlay;
    }

    function open() {
        var overlay = build();
        var html = document.documentElement;
        var body = document.body;
        var scrollY = window.scrollY || 0;

        body.appendChild(overlay);

        // Hard scroll lock: works in Safari and with trackpads, unlike overflow alone.
        body.style.top = (-scrollY) + 'px';
        html.classList.add('gate-open');
        body.classList.add('gate-open');

        // Block wheel and touch scrolling on the backdrop; allow it inside the card.
        function stopScroll(e) {
            var card = overlay.querySelector('.gate-card');
            if (card && card.contains(e.target) && card.scrollHeight > card.clientHeight) return;
            e.preventDefault();
        }
        overlay.addEventListener('wheel', stopScroll, { passive: false });
        overlay.addEventListener('touchmove', stopScroll, { passive: false });

        var btn = overlay.querySelector('#gate-btn');

        // Keep focus inside the dialog. Escape does not dismiss; the button does.
        overlay.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') { e.preventDefault(); btn.focus(); }
            if (e.key === 'Escape') { e.preventDefault(); }
        });
        document.addEventListener('focusin', function trap(e) {
            if (!overlay.contains(e.target)) btn.focus();
            overlay._trap = trap;
        });

        function dismiss() {
            overlay.classList.add('gate-out');
            html.classList.remove('gate-open');
            body.classList.remove('gate-open');
            body.style.top = '';
            window.scrollTo(0, scrollY);
            if (overlay._trap) document.removeEventListener('focusin', overlay._trap);
            setTimeout(function () { overlay.remove(); }, 350);
        }

        btn.addEventListener('click', function () {
            if (btn.disabled) return;
            btn.disabled = true;
            remember();

            var card = overlay.querySelector('.gate-card');

            // Stage under the lock: name, title, countdown.
            var stage = document.createElement('div');
            stage.className = 'gate-stage';
            stage.innerHTML =
                '<p class="gate-stage-tag">Player 1</p>' +
                '<p class="gate-stage-name">Gradi Kayamba</p>' +
                '<p class="gate-stage-title">Master web developer &middot; Lvl 99</p>' +
                '<p class="gate-stage-count">3</p>';
            card.appendChild(stage);
            var count = stage.querySelector('.gate-stage-count');

            // 1) Lock comes forward, text falls back.
            card.classList.add('gate-unlocking');

            // 2) Countdown while the lock shakes.
            var n = 3;
            var tick = setInterval(function () {
                n -= 1;
                if (n <= 0) {
                    clearInterval(tick);
                    count.textContent = '';
                    // 3) Pop open: ink burst, ACCESS GRANTED stamp, XP float. Then voila.
                    card.classList.add('gate-popped');
                    var burst = document.createElement('div');
                    burst.className = 'gate-burst';
                    for (var i = 0; i < 14; i++) {
                        var dot = document.createElement('span');
                        dot.style.setProperty('--a', (i * (360 / 14)) + 'deg');
                        dot.style.setProperty('--d', (60 + (i % 3) * 22) + 'px');
                        burst.appendChild(dot);
                    }
                    card.appendChild(burst);
                    var grant = document.createElement('div');
                    grant.className = 'gate-grant';
                    grant.textContent = 'Access granted';
                    card.appendChild(grant);
                    var xp = document.createElement('div');
                    xp.className = 'gate-xp';
                    xp.textContent = '+100 XP';
                    card.appendChild(xp);
                    setTimeout(dismiss, 1500);
                    return;
                }
                count.textContent = n;
                count.classList.remove('gate-count-pop');
                void count.offsetWidth;
                count.classList.add('gate-count-pop');
            }, 1000);
        });

        requestAnimationFrame(function () {
            overlay.classList.add('gate-in');
            // The overlay is painted now, so the pre-paint paper cover can go.
            html.classList.remove('gate-pending');
            btn.focus();
        });
    }

    // Footer "All rights reserved" link re-opens the notice on demand.
    document.addEventListener('click', function (e) {
        var trigger = e.target.closest && e.target.closest('[data-gate-open]');
        if (!trigger) return;
        e.preventDefault();
        if (!document.querySelector('.gate')) open();
    });
    window.ArtivicoGate = { open: open };

    // ?peek=1 lets the Privacy link from inside the notice open without the notice
    // (the visitor hasn't acknowledged yet). Nothing is remembered.
    if (/[?&]peek=1\b/.test(location.search)) {
        document.documentElement.classList.remove('gate-pending');
        return;
    }

    if (acked()) return;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', open);
    } else {
        open();
    }
})();
