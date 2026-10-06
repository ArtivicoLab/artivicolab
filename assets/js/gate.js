/**
 * ArtivicoLab entry notice, the listening room
 *
 * The welcome, in order:
 *   1. puzzle.js  tap the runway lamps back
 *   2. this file  Parade plays twice while the lab's story is on screen,
 *                 a timer counts down to the doors opening
 *   3. access granted, good for one hour
 *
 * Access is a timestamp, not a flag: `artivicolab_access_until`. When it
 * runs out the whole welcome plays again. The same key is read by the
 * inline pre-paint script in every page, so change it in both places.
 *
 * gate.js is the orchestrator. puzzle.js is a component it calls, and it
 * must load first. The music is the real footer player in beats.js, which
 * is why the winning lamp tap starts it: iOS only allows audio to begin
 * inside a user gesture.
 *
 * The footer "Replay the welcome" button runs the whole thing on demand.
 */
(function () {
    'use strict';

    var KEY = 'artivicolab_access_until';
    var ACCESS_MS = 60 * 60 * 1000;   // one hour
    var PLAYS = 2;                     // how many times Parade must play
    var TRACK = 'parade';

    function until() {
        try { return parseInt(localStorage.getItem(KEY), 10) || 0; } catch (e) { return 0; }
    }
    function hasAccess() { return Date.now() < until(); }
    function grantAccess() {
        try { localStorage.setItem(KEY, String(Date.now() + ACCESS_MS)); } catch (e) { /* private mode, fine */ }
    }
    function clearAccess() {
        try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    }

    // How long two plays of Parade actually run, read from the synth itself
    // so retiming the track retimes the gate.
    function listenSeconds() {
        var B = window.ArtivicoBeats, t = null, i;
        if (B && B.tracks) for (i = 0; i < B.tracks.length; i++) if (B.tracks[i].id === TRACK) t = B.tracks[i];
        if (!t) return 116;
        return t.bars * 4 * (60 / t.bpm) * PLAYS;
    }

    var savedTrack = null, captured = false;

    // Must be called inside a user gesture or iOS refuses to make a sound.
    // Called more than once when the visitor restarts the sound, so the
    // visitor's own footer track is captured only on the first pass,
    // before choose() overwrites it with Parade.
    function primeAudio() {
        var B = window.ArtivicoBeats;
        if (!B) return;
        if (!captured) {
            captured = true;
            try { savedTrack = localStorage.getItem('artivicolab.track'); } catch (e) { savedTrack = null; }
        }
        try { B.play(TRACK); } catch (e) { /* the clock stays stopped, which is the point */ }
    }
    function restoreTrack() {
        captured = false;
        if (savedTrack === null) return;
        try { localStorage.setItem('artivicolab.track', savedTrack); } catch (e) { /* ignore */ }
        savedTrack = null;
    }

    function clock(sec) {
        sec = Math.max(0, Math.ceil(sec));
        var m = Math.floor(sec / 60), s = sec % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
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
                '<h2 id="gate-title" class="gate-title">Ten thousand hours.</h2>' +
                '<div id="gate-body" class="gate-body">' +
                    '<p>ArtivicoLab is the work of one self-taught software engineer. <strong>Gradi Kayamba</strong> learned to build by building, and kept going: ten thousand hours of writing code, breaking it, and writing it again.</p>' +
                    '<p><strong>Everything on this site is original.</strong> Every line of code, every layout, every drawing, and every sound, including the one playing right now, was made in this lab. Nothing here is bought, borrowed, or lifted from somebody else\'s library.</p>' +
                '</div>' +
                '<div class="gate-listen">' +
                    '<p class="gate-listen-label">Sound required &middot; <strong>Parade</strong>, twice through</p>' +
                    '<div class="gate-listen-bar" role="progressbar" aria-labelledby="gate-listen-time" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="gate-listen-bar"><div class="gate-listen-fill" id="gate-listen-fill"></div></div>' +
                    '<p class="gate-listen-time" id="gate-listen-time" aria-live="off"><span class="gate-listen-clock" id="gate-listen-clock">0:00</span> until the doors open</p>' +
                    '<p class="gate-listen-note" id="gate-listen-note" aria-live="polite">Brass fanfare and flute, 132 BPM, built from oscillators in your browser. Stay with it.</p>' +
                    '<button type="button" class="gate-sound" id="gate-sound" hidden>Turn the sound on</button>' +
                '</div>' +
                '<p class="gate-fine">Access lasts one hour, then the welcome plays again. This site uses Google Analytics for visit counts, see <a href="privacy.html?peek=1" class="gate-link" target="_blank" rel="noopener">Privacy</a>.</p>' +
            '</div>';
        return overlay;
    }

    function open() {
        if (document.querySelector('.gate')) return;

        var overlay = build();
        var html = document.documentElement;
        var body = document.body;
        var scrollY = window.scrollY || 0;

        body.appendChild(overlay);
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

        var card = overlay.querySelector('.gate-card');
        var fill = overlay.querySelector('#gate-listen-fill');
        var bar = overlay.querySelector('#gate-listen-bar');
        var clockEl = overlay.querySelector('#gate-listen-clock');
        var note = overlay.querySelector('#gate-listen-note');
        var link = overlay.querySelector('.gate-link');

        // Escape does not dismiss. The timer is the way out.
        overlay.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); return; }
            if (e.key !== 'Tab') return;
            e.preventDefault();
            var f = [overlay.querySelector('#gate-sound'), link].filter(function (el) { return el && !el.hidden; });
            if (!f.length) return;
            var i = f.indexOf(document.activeElement);
            f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        });
        function trap(e) {
            if (overlay.contains(e.target)) return;
            if (link) link.focus(); else card.focus();
        }
        document.addEventListener('focusin', trap);

        function dismiss() {
            // The toll is paid, so the music stops with the overlay. Leaving
            // it running meant Parade played on in the background while the
            // visitor read the site, which nobody asked for.
            try { if (window.ArtivicoBeats && window.ArtivicoBeats.stop) window.ArtivicoBeats.stop(); } catch (e) { /* ignore */ }
            overlay.classList.add('gate-out');
            html.classList.remove('gate-open');
            body.classList.remove('gate-open');
            body.style.top = '';
            window.scrollTo(0, scrollY);
            document.removeEventListener('focusin', trap);
            setTimeout(function () { overlay.remove(); }, 350);
        }

        function unlock() {
            grantAccess();
            restoreTrack();

            // Stage under the lock: name, title, countdown.
            var stage = document.createElement('div');
            stage.className = 'gate-stage';
            stage.innerHTML =
                '<p class="gate-stage-tag">Player 1</p>' +
                '<p class="gate-stage-name">Gradi Kayamba</p>' +
                '<p class="gate-stage-title">Self-taught &middot; 10,000 hours</p>' +
                '<p class="gate-stage-count">3</p>';
            card.appendChild(stage);
            var count = stage.querySelector('.gate-stage-count');

            card.classList.add('gate-unlocking');

            var n = 3;
            var tick = setInterval(function () {
                n -= 1;
                if (n <= 0) {
                    clearInterval(tick);
                    count.textContent = '';
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

        /* ── The listen. The clock only moves while sound is actually
           coming out of the page. Paused, blocked or muted and it stops
           dead: there is no way in that does not go through hearing it. ── */
        var total = listenSeconds();
        var heard = 0, last = Date.now(), everHeard = false;
        var soundBtn = overlay.querySelector('#gate-sound');
        var NOTE_ON = 'Brass fanfare and flute, 132 BPM, built from oscillators in your browser. Stay with it.';

        clockEl.textContent = clock(total);
        soundBtn.addEventListener('click', function () { primeAudio(); });

        // What counts as hearing it. A browser will not tell a page the
        // speaker volume or whether the tab is muted, so those cannot be
        // detected here or anywhere else. These are the signals that exist.
        var reason = '';
        function audible() {
            var B = window.ArtivicoBeats;
            if (document.hidden) { reason = 'away'; return false; }
            if (!B || !B.isPlaying || !B.level) { reason = 'off'; return false; }
            if (B.muted && B.muted()) { reason = 'off'; return false; }
            if (!B.isPlaying()) { reason = 'off'; return false; }
            if (B.level() <= 0.003) { reason = 'off'; return false; }
            reason = '';
            return true;
        }
        // Leaving the tab stops the clock the moment it happens, rather than
        // on the next tick, and picks it straight back up on return.
        document.addEventListener('visibilitychange', function () { last = Date.now(); });

        var timer = setInterval(function () {
            var now = Date.now(), dt = (now - last) / 1000;
            last = now;

            if (audible()) {
                heard += dt;
                everHeard = true;
                overlay.classList.remove('gate-silent');
                soundBtn.hidden = true;
                if (note.textContent !== NOTE_ON) note.textContent = NOTE_ON;
            } else {
                overlay.classList.add('gate-silent');
                soundBtn.hidden = false;
                note.textContent = reason === 'away'
                    ? 'You left this tab, so the clock stopped. Come back and it picks up where it was.'
                    : everHeard
                        ? 'Sound off, clock stopped. Access stays denied until Parade has played all the way through.'
                        : 'Turn your sound on. The clock does not move in silence, and access stays denied until you have heard Parade twice.';
            }

            var left = total - heard;
            fill.style.width = Math.min(100, (heard / total) * 100).toFixed(2) + '%';
            bar.setAttribute('aria-valuenow', Math.round(Math.min(100, (heard / total) * 100)));
            clockEl.textContent = clock(left);

            if (left <= 0) {
                clearInterval(timer);
                fill.style.width = '100%';
                clockEl.textContent = '0:00';
                unlock();
            }
        }, 200);

        requestAnimationFrame(function () {
            overlay.classList.add('gate-in');
            // The overlay is painted now, so the pre-paint paper cover can go.
            html.classList.remove('gate-pending');
            if (link) link.focus();
        });
    }

    /* ── Orchestration ── */

    function runFlow() {
        var P = window.ArtivicoPuzzle;
        if (P && P.open) P.open(open, primeAudio);
        else open();
    }

    function replay() {
        if (document.querySelector('.gate') || document.querySelector('.puzzle')) return;
        clearAccess();
        runFlow();
    }

    // Footer: "Replay the welcome", and the long-standing All rights reserved link.
    document.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('[data-access-replay], [data-gate-open]');
        if (!t) return;
        e.preventDefault();
        replay();
    });

    window.ArtivicoGate = {
        open: open,
        replay: replay,
        hasAccess: hasAccess,
        expiresAt: until,
        listenSeconds: listenSeconds
    };

    // ?peek=1 lets the Privacy link from inside the notice open on its own.
    // Nothing is granted and nothing is remembered.
    if (/[?&]peek=1\b/.test(location.search)) {
        document.documentElement.classList.remove('gate-pending');
        return;
    }

    if (hasAccess()) return;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runFlow);
    } else {
        runFlow();
    }
})();
