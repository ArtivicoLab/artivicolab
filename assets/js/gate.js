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
                '<p class="eyebrow">Notice &middot; before you enter</p>' +
                '<h2 id="gate-title" class="gate-title">All rights reserved.</h2>' +
                '<p id="gate-body" class="gate-body">Everything on this site is the work of <strong>Gradi Kayamba</strong>, published under <strong>ArtivicoLab</strong> supervision. Look around, use the apps, fork the templates that say you can. Just don\'t pass any of it off as your own.</p>' +
                '<div class="gate-cta">' +
                    '<button type="button" class="gate-btn" id="gate-btn">Understood, chef Gradi.</button>' +
                    '<svg class="gate-arrow" viewBox="0 0 120 60" aria-hidden="true" focusable="false">' +
                        '<path d="M112,10 C95,8 70,14 48,30 C36,39 26,44 12,46" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
                        '<path d="M26,36 C20,41 16,44 11,46 C16,47 21,50 25,54" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
                    '</svg>' +
                    '<span class="gate-hint">click here</span>' +
                '</div>' +
                '<p class="gate-fine">Shown once. Clicking means you read it.</p>' +
                '<p class="gate-fine gate-stamp">Site updated &middot; September 14, 2026 · 8:58 AM EDT</p>' +
            '</div>';
        return overlay;
    }

    function open() {
        var overlay = build();
        document.body.appendChild(overlay);
        document.body.classList.add('gate-open');
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

        btn.addEventListener('click', function () {
            remember();
            overlay.classList.add('gate-out');
            document.body.classList.remove('gate-open');
            if (overlay._trap) document.removeEventListener('focusin', overlay._trap);
            setTimeout(function () { overlay.remove(); }, 350);
        });

        requestAnimationFrame(function () {
            overlay.classList.add('gate-in');
            btn.focus();
        });
    }

    if (acked()) return;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', open);
    } else {
        open();
    }
})();
