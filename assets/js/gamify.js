/**
 * ArtivicoLab gamification layer
 * Computes lab stats from SHOWCASE_WEBSITES, animates counters,
 * renders the trophy case, fires "achievement unlocked" toasts.
 * Loads after data.js and before script.js so cards can read rarity + XP.
 */
(function () {
    'use strict';

    const XP = { legendary: 150, rare: 100, uncommon: 75, common: 40 };
    const XP_PER_LEVEL = 250;
    const reduceMotion = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function rarityOf(w) {
        if (w.category === 'template') return 'common';
        if (w.subcategory === 'planner') return 'rare';
        if (/directory/i.test((w.metadata && w.metadata.type) || '')) return 'legendary';
        return 'uncommon';
    }

    function xpOf(w) { return XP[rarityOf(w)]; }

    // Exposed for script.js card rendering.
    window.ArtivicoGame = { rarityOf, xpOf };

    function computeStats() {
        const all = SHOWCASE_WEBSITES;
        const apps = all.filter(w => w.category === 'application');
        const templates = all.filter(w => w.category === 'template');
        const planners = apps.filter(w => w.subcategory === 'planner');
        const directories = apps.filter(w => rarityOf(w) === 'legendary');
        const xp = all.reduce((sum, w) => sum + xpOf(w), 0);
        const level = Math.floor(xp / XP_PER_LEVEL) + 1;
        const intoLevel = xp % XP_PER_LEVEL;
        return {
            apps: apps.length,
            templates: templates.length,
            planners: planners.length,
            directories: directories.length,
            total: all.length,
            xp: xp,
            level: level,
            toNext: XP_PER_LEVEL - intoLevel,
            pct: intoLevel / XP_PER_LEVEL
        };
    }

    function achievements(s) {
        return [
            { name: 'First Ship',        desc: 'One app in the field',              icon: '⚑', ok: s.apps >= 1 },
            { name: 'Double Digits',     desc: '10 apps shipped',                   icon: '◆', ok: s.apps >= 10 },
            { name: 'Lab Rat',           desc: '20 apps shipped',                   icon: '●', ok: s.apps >= 20 },
            { name: 'Directory Deity',   desc: '4 statewide directories',           icon: '▲', ok: s.directories >= 4 },
            { name: 'Sheet Wizard',      desc: '5 or more bring-your-own-Sheet planners', icon: '■', ok: s.planners >= 5 },
            { name: 'Template Tinkerer', desc: '8 templates in the archive',        icon: '◇', ok: s.templates >= 8 },
            { name: 'No Servers',        desc: 'Every app runs without a backend',  icon: '○', ok: true },
            { name: 'Thirty',            desc: '30 total shipped',                  icon: '☆', ok: s.total >= 30 }
        ];
    }

    function countUp(el, target, duration) {
        if (reduceMotion || duration <= 0) { el.textContent = target; return; }
        const start = performance.now();
        function tick(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(target * eased);
            if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function renderCharsheet(s) {
        document.querySelectorAll('[data-count]').forEach(el => {
            const target = s[el.getAttribute('data-count')];
            if (typeof target !== 'number') return;
            countUp(el, target, 1200);
        });
        const fill = document.querySelector('[data-xp-fill]');
        if (fill) {
            // Let the initial 0% width paint first, then animate.
            requestAnimationFrame(() => requestAnimationFrame(() => {
                fill.style.width = (s.pct * 100).toFixed(1) + '%';
            }));
        }
    }

    function renderTrophies(s) {
        const grid = document.getElementById('trophy-grid');
        if (!grid) return;
        grid.innerHTML = achievements(s).map(a => `
            <div class="trophy${a.ok ? '' : ' trophy--locked'}" title="${a.desc}">
                <span class="trophy-icon" aria-hidden="true">${a.icon}</span>
                <span class="trophy-name">${a.name}</span>
                <span class="trophy-desc">${a.ok ? 'Unlocked' : 'Locked'}</span>
            </div>
        `).join('');
    }

    let toastTimer = null;
    function toast(html, ms) {
        const el = document.getElementById('toast');
        if (!el || reduceMotion) return;
        el.innerHTML = html;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), ms || 3200);
    }

    function wireEasterEgg() {
        const mascot = document.querySelector('.intro-mascot');
        if (!mascot) return;
        let pokes = 0;
        mascot.addEventListener('click', () => {
            pokes += 1;
            if (pokes === 5) {
                toast('<strong>Achievement unlocked</strong> &middot; Poked the specimen', 3600);
                mascot.classList.add('poked');
                setTimeout(() => mascot.classList.remove('poked'), 900);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (typeof SHOWCASE_WEBSITES === 'undefined') return;
        const s = computeStats();
        renderCharsheet(s);
        renderTrophies(s);
        wireEasterEgg();
        setTimeout(() => toast('<strong>Achievement unlocked</strong> &middot; Entered the lab', 3000), 900);
    });
})();
