/**
 * ArtivicoLab entry notice, with a puzzle
 * First visit only: shows a rights notice and a short puzzle. Four runway
 * lamps flash in an order; the visitor taps them back. Solve it and the
 * lock pops. Three misses and the lab lets you in anyway, because a gate
 * that can lock out a real person is the one mistake this site has
 * already made once (see CLAUDE.md). Remembered in localStorage so it
 * never repeats. The overlay is script-only: the page underneath is
 * complete HTML, so search engines index it as before.
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
                '<div class="gate-puzzle" id="gate-puzzle">' +
                    '<p class="gate-puzzle-ask">One small thing first. <strong>Watch the runway lamps, then tap them back in the same order.</strong></p>' +
                    '<div class="gate-lamps" role="group" aria-label="Runway lamps">' +
                        '<button type="button" class="gate-lamp" data-lamp="0" aria-label="Lamp 1, green"><span></span></button>' +
                        '<button type="button" class="gate-lamp" data-lamp="1" aria-label="Lamp 2, amber"><span></span></button>' +
                        '<button type="button" class="gate-lamp" data-lamp="2" aria-label="Lamp 3, amber"><span></span></button>' +
                        '<button type="button" class="gate-lamp" data-lamp="3" aria-label="Lamp 4, red"><span></span></button>' +
                    '</div>' +
                    '<p class="gate-status" id="gate-status" aria-live="polite">Watch.</p>' +
                    '<p class="gate-sr" id="gate-sr" aria-live="polite"></p>' +
                    '<button type="button" class="gate-replay" id="gate-replay">Show me again</button>' +
                '</div>' +
                '<div class="gate-cta" hidden>' +
                    '<button type="button" class="gate-btn" id="gate-btn" tabindex="-1" aria-hidden="true">' +
                        '<svg class="gate-lock" viewBox="0 0 32 40" aria-hidden="true" focusable="false">' +
                            '<path class="gate-lock-shackle" d="M9,18 C8,7 11,3 16,3 C21,3 24,7 23,18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
                            '<path class="gate-lock-body" d="M5,18 C12,17 20,17 27,18 C28,25 27,31 27,36 C20,37 12,37 5,36 C5,31 4,25 5,18 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
                        '</svg>' +
                    '</button>' +
                '</div>' +
                '<p class="gate-fine">Shown once. Solving it means you read the notice. This site uses Google Analytics for visit counts, see <a href="privacy.html?peek=1" class="gate-link" target="_blank" rel="noopener">Privacy</a>.</p>' +
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
        var lamps = Array.prototype.slice.call(overlay.querySelectorAll('.gate-lamp'));
        var status = overlay.querySelector('#gate-status');
        var sr = overlay.querySelector('#gate-sr');
        var replay = overlay.querySelector('#gate-replay');
        var focusables = function () {
            return Array.prototype.slice.call(overlay.querySelectorAll('.gate-lamp, .gate-replay, .gate-link')).filter(function (el) { return !el.disabled; });
        };

        // Keep focus inside the dialog. Escape does not dismiss; the puzzle does.
        overlay.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                var f = focusables(); if (!f.length) return;
                var i = f.indexOf(document.activeElement);
                e.preventDefault();
                f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
            }
            if (e.key === 'Escape') { e.preventDefault(); }
        });
        document.addEventListener('focusin', function trap(e) {
            if (!overlay.contains(e.target)) { var f = focusables(); if (f[0]) f[0].focus(); }
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

        function unlock() {
            if (btn.disabled) return;
            btn.disabled = true;
            remember();
            overlay.querySelector('.gate-cta').hidden = false;

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
        }

        /* ── The puzzle ── */
        var LEN = 4, MISSES = 3;
        var seq = [], typed = [], misses = 0, showing = false, solved = false, timers = [];
        var names = ['green', 'amber', 'amber', 'red'];

        function makeSeq() {
            seq = [];
            while (seq.length < LEN) {
                var n = Math.floor(Math.random() * 4);
                if (seq.length >= 2 && seq[seq.length - 1] === n && seq[seq.length - 2] === n) continue;
                seq.push(n);
            }
        }
        function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
        function clearTimers() { timers.forEach(clearTimeout); timers = []; }
        function light(i, ms) {
            lamps[i].classList.add('is-lit');
            later(function () { lamps[i].classList.remove('is-lit'); }, ms);
        }
        function say(text) { status.textContent = text; }

        function show() {
            if (solved) return;
            clearTimers();
            showing = true; typed = [];
            overlay.classList.add('gate-showing');
            lamps.forEach(function (l) { l.classList.remove('is-lit'); });
            say('Watch.');
            sr.textContent = '';
            var ON = 380, GAP = 230;
            seq.forEach(function (i, k) {
                later(function () {
                    light(i, ON);
                    sr.textContent = 'Lamp ' + (i + 1) + ', ' + names[i];
                }, 500 + k * (ON + GAP));
            });
            later(function () {
                showing = false;
                overlay.classList.remove('gate-showing');
                say('Your turn.');
                lamps[0].focus();
            }, 500 + seq.length * (ON + GAP) + 200);
        }

        function miss() {
            misses += 1;
            overlay.classList.add('gate-miss');
            later(function () { overlay.classList.remove('gate-miss'); }, 450);
            if (misses >= MISSES) {
                say('Three tries. The lab lets you in anyway.');
                solved = true;
                lamps.forEach(function (l) { l.disabled = true; });
                replay.disabled = true;
                later(unlock, 1100);
                return;
            }
            say(misses === 1 ? 'Not quite. Once more.' : 'Close. Last try, then we let you in regardless.');
            later(show, 900);
        }

        function press(i) {
            if (showing || solved) return;
            light(i, 180);
            typed.push(i);
            var k = typed.length - 1;
            if (typed[k] !== seq[k]) { miss(); return; }
            if (typed.length === seq.length) {
                solved = true;
                say('That is the one.');
                lamps.forEach(function (l) { l.disabled = true; });
                replay.disabled = true;
                later(unlock, 500);
            }
        }

        lamps.forEach(function (l) {
            l.addEventListener('click', function () { press(parseInt(l.getAttribute('data-lamp'), 10)); });
        });
        replay.addEventListener('click', function () { if (!showing && !solved) show(); });

        makeSeq();
        overlay._seq = seq;

        requestAnimationFrame(function () {
            overlay.classList.add('gate-in');
            // The overlay is painted now, so the pre-paint paper cover can go.
            html.classList.remove('gate-pending');
            later(show, 700);
        });
    }

    // Footer "All rights reserved" link re-opens the notice on demand.
    document.addEventListener('click', function (e) {
        var trigger = e.target.closest && e.target.closest('[data-gate-open]');
        if (!trigger) return;
        e.preventDefault();
        if (!document.querySelector('.gate')) open();
    });
    window.ArtivicoGate = { open: open, sequence: function () { var g = document.querySelector('.gate'); return g && g._seq ? g._seq.slice() : null; } };

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
