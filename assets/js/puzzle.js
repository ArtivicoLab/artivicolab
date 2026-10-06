/**
 * ArtivicoLab entry puzzle
 *
 * Four runway lamps flash a sequence and the visitor taps it back. It is a
 * component, not a decision maker: it opens when gate.js asks it to and
 * calls back when the visitor is through. gate.js owns the question of who
 * needs to see it. Keep puzzle.js loading BEFORE gate.js on every page.
 *
 * Styles live under the ENTRY PUZZLE banner in styles.css. Delete this
 * file, its styles and its script tag and the welcome goes straight to the
 * notice, which is how it worked before 2026-10-06.
 *
 * THE MERCY RULE, DO NOT REMOVE IT. Three misses and the visitor is let
 * through regardless. This site already locked real people out for days
 * with the IP gate in September 2026 (see CLAUDE.md). A puzzle is a
 * greeting, not a wall. The overlay is script-only and the page underneath
 * is complete HTML, so the site stays readable and indexable whatever
 * happens in here.
 */
(function () {
    'use strict';

    var LEN = 4, MISSES = 3, ON = 380, GAP = 230;
    var NAMES = ['green', 'amber', 'amber', 'red'];
    var active = null;

    function makeSeq() {
        var seq = [];
        while (seq.length < LEN) {
            var n = Math.floor(Math.random() * 4);
            // No three of the same lamp in a row: hard to read, hard to repeat.
            if (seq.length >= 2 && seq[seq.length - 1] === n && seq[seq.length - 2] === n) continue;
            seq.push(n);
        }
        return seq;
    }

    function build() {
        var overlay = document.createElement('div');
        overlay.className = 'puzzle';
        overlay.innerHTML =
            '<div class="puzzle-card" role="dialog" aria-modal="true" aria-labelledby="puzzle-title" aria-describedby="puzzle-body">' +
                '<p class="eyebrow">Before you enter</p>' +
                '<h2 id="puzzle-title" class="puzzle-title">Watch the lamps.</h2>' +
                '<p id="puzzle-body" class="puzzle-body">Four runway lamps flash in order. Tap them back the same way.</p>' +
                '<div class="puzzle-lamps" role="group" aria-label="Runway lamps">' +
                    '<button type="button" class="puzzle-lamp" data-lamp="0" aria-label="Lamp 1, green"><span></span></button>' +
                    '<button type="button" class="puzzle-lamp" data-lamp="1" aria-label="Lamp 2, amber"><span></span></button>' +
                    '<button type="button" class="puzzle-lamp" data-lamp="2" aria-label="Lamp 3, amber"><span></span></button>' +
                    '<button type="button" class="puzzle-lamp" data-lamp="3" aria-label="Lamp 4, red"><span></span></button>' +
                '</div>' +
                '<p class="puzzle-status" id="puzzle-status" aria-live="polite">Watch.</p>' +
                '<p class="puzzle-sr" id="puzzle-sr" aria-live="polite"></p>' +
                '<button type="button" class="puzzle-replay" id="puzzle-replay">Show me again</button>' +
                '<p class="puzzle-fine">Three tries, then the lab lets you in anyway.</p>' +
            '</div>';
        return overlay;
    }

    /**
     * open(onDone, onWin)
     *   onDone runs once the overlay is gone, however the visitor got through.
     *   onWin runs inside the winning tap, still in the user gesture, which
     *   is the only moment audio is allowed to start on iOS. gate.js uses it
     *   to get the music going.
     */
    function open(onDone, onWin) {
        if (document.querySelector('.puzzle')) return;

        var seq = makeSeq(), typed = [], misses = 0;
        var showing = false, done = false, timers = [];
        var overlay = build();
        var html = document.documentElement;
        var body = document.body;
        var scrollY = window.scrollY || 0;

        body.appendChild(overlay);
        body.style.top = (-scrollY) + 'px';
        html.classList.add('puzzle-open');
        body.classList.add('puzzle-open');
        active = { seq: seq };

        function stopScroll(e) { e.preventDefault(); }
        overlay.addEventListener('wheel', stopScroll, { passive: false });
        overlay.addEventListener('touchmove', stopScroll, { passive: false });

        var lamps = Array.prototype.slice.call(overlay.querySelectorAll('.puzzle-lamp'));
        var status = overlay.querySelector('#puzzle-status');
        var sr = overlay.querySelector('#puzzle-sr');
        var replay = overlay.querySelector('#puzzle-replay');

        function focusables() {
            return lamps.concat([replay]).filter(function (el) { return !el.disabled; });
        }

        // Focus stays in the dialog. Escape is ignored: finishing is the way out.
        overlay.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); return; }
            if (e.key !== 'Tab') return;
            var f = focusables(); if (!f.length) return;
            e.preventDefault();
            var i = f.indexOf(document.activeElement);
            f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        });
        function trap(e) {
            if (overlay.contains(e.target)) return;
            var f = focusables(); if (f[0]) f[0].focus();
        }
        document.addEventListener('focusin', trap);

        function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
        function clearTimers() { timers.forEach(clearTimeout); timers = []; }
        function say(t) { status.textContent = t; }
        function light(i, ms) {
            lamps[i].classList.add('is-lit');
            later(function () { lamps[i].classList.remove('is-lit'); }, ms);
        }

        function show() {
            if (done) return;
            clearTimers();
            showing = true; typed = [];
            overlay.classList.add('is-showing');
            lamps.forEach(function (l) { l.classList.remove('is-lit'); });
            say('Watch.');
            sr.textContent = '';
            seq.forEach(function (i, k) {
                later(function () {
                    light(i, ON);
                    sr.textContent = 'Lamp ' + (i + 1) + ', ' + NAMES[i];
                }, 500 + k * (ON + GAP));
            });
            later(function () {
                showing = false;
                overlay.classList.remove('is-showing');
                say('Your turn.');
                lamps[0].focus();
            }, 500 + seq.length * (ON + GAP) + 200);
        }

        function finish(message) {
            done = true;
            clearTimers();
            lamps.forEach(function (l) { l.disabled = true; });
            replay.disabled = true;
            say(message);
            overlay.classList.add('is-done');
            setTimeout(function () {
                overlay.classList.add('is-out');
                html.classList.remove('puzzle-open');
                body.classList.remove('puzzle-open');
                body.style.top = '';
                window.scrollTo(0, scrollY);
                document.removeEventListener('focusin', trap);
                setTimeout(function () {
                    overlay.remove();
                    active = null;
                    if (typeof onDone === 'function') onDone();
                }, 340);
            }, 900);
        }

        function miss() {
            misses += 1;
            overlay.classList.add('is-miss');
            later(function () { overlay.classList.remove('is-miss'); }, 450);
            if (misses >= MISSES) { finish('Three tries. In you go.'); return; }
            say(misses === 1 ? 'Not quite. Once more.' : 'Close. Last try, then we let you in regardless.');
            later(show, 900);
        }

        function press(i) {
            if (showing || done) return;
            light(i, 180);
            typed.push(i);
            var k = typed.length - 1;
            if (typed[k] !== seq[k]) { miss(); return; }
            if (typed.length !== seq.length) return;
            // Still inside the click. The only safe place to start audio.
            if (typeof onWin === 'function') { try { onWin(); } catch (e) { /* never block the gate */ } }
            finish('That is the one.');
        }

        lamps.forEach(function (l) {
            l.addEventListener('click', function () { press(parseInt(l.getAttribute('data-lamp'), 10)); });
        });
        replay.addEventListener('click', function () { if (!showing && !done) show(); });

        requestAnimationFrame(function () {
            overlay.classList.add('is-in');
            // The puzzle is painted, so the pre-paint paper cover can go.
            html.classList.remove('gate-pending');
            later(show, 700);
        });
    }

    window.ArtivicoPuzzle = {
        open: open,
        sequence: function () { return active ? active.seq.slice() : null; }
    };
})();
