/**
 * Client-side IP gate, arcade edition, with a sci-fi verification sequence.
 *
 * NOT real access control: this only hides page content in browsers that
 * execute this script. The underlying HTML/CSS/JS is still publicly
 * fetchable by anything that doesn't run JavaScript, curl, bots, search
 * engines, view-source. Real enforcement requires a server or edge layer
 * (e.g. Cloudflare) in front of the site, which this host does not have.
 *
 * Fails closed: if the visitor's IP can't be verified (lookup blocked,
 * offline, timed out), the page is blocked rather than shown.
 */
(function () {
    'use strict';

    // Edit this list to change who gets in. Everyone not listed here gets
    // the block screen.
    //
    // Both entries below are the owner's home connection as of 2026-09-18,
    // IPv4 and IPv6. Note the IPv6 address can rotate on its own with many
    // ISPs, which would lock the owner out with no warning. If that happens,
    // get the current address from https://api64.ipify.org and update it
    // here, or run scripts/remove-ip-gate.sh to strip the gate entirely.
    var ALLOWED_IPS = [
        '76.122.79.245',
        '2601:c4:c002:c10:789d:7f1d:7852:5873'
    ];

    // How long the scan runs before showing a verdict, even if the IP lookup
    // came back sooner. The result is cached (see below) so this only plays
    // once an hour, not on every page load.
    var MIN_SCAN_MS = 30000;

    // Verdict cache. Once a scan completes, the result is stored and reused
    // for an hour, so normal browsing doesn't re-run the 10 second sequence.
    // Note: if the visitor's network changes inside that hour, they keep the
    // cached verdict until it expires.
    var CACHE_KEY = 'artivicolab_ipgate_v1';
    var CACHE_TTL_MS = 60 * 60 * 1000;

    var RANKS = [
        'Trespasser',
        'Uninvited Guest',
        'Lost Tourist',
        'Script Kiddie',
        'Curious Cat',
        'Wrong Neighborhood',
        'Door Rattler',
        'Guest List: Not Found'
    ];

    // Shown one at a time under the log, cycling as the wait drags on.
    var NOTES = [
        'This will only take a few seconds',
        'Please be patient',
        'Almost there',
        'Just a moment longer',
        'Hang tight',
        'Nearly finished',
        'Any second now',
        'Thank you for your patience'
    ];

    var SCAN_LINES = [
        'ESTABLISHING UPLINK',
        'NEGOTIATING HANDSHAKE',
        'EXCHANGING KEYS',
        'READING NETWORK SIGNATURE',
        'RESOLVING ORIGIN NODE',
        'TRACING ROUTE',
        'GEOLOCATING ENDPOINT',
        'PROFILING USER AGENT',
        'CROSS-REFERENCING REGISTRY',
        'QUERYING THREAT DATABASE',
        'ANALYSING PACKET HEADERS',
        'CHECKING ACCESS CONTROL LIST',
        'RUNNING HEURISTICS',
        'RECALIBRATING SENSORS',
        'CONSULTING THE ARCHIVE',
        'DOUBLE CHECKING',
        'TRIPLE CHECKING',
        'VALIDATING CREDENTIALS',
        'COMPILING REPORT',
        'FINALIZING'
    ];

    var html = document.documentElement;
    var done = false;
    var startedAt = Date.now();
    var loader = null;

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function pad(n, len) {
        var s = String(n);
        while (s.length < len) s = '0' + s;
        return s;
    }

    function hexRow() {
        var out = '';
        for (var i = 0; i < 8; i++) {
            out += pad(Math.floor(Math.random() * 65536).toString(16).toUpperCase(), 4) + ' ';
        }
        return out;
    }

    // Readable browser + OS from the user agent.
    function browserInfo() {
        var ua = navigator.userAgent;
        var m;
        var browser = 'Unknown browser';

        if ((m = ua.match(/Edg\/([\d.]+)/)))                  browser = 'Edge ' + m[1];
        else if ((m = ua.match(/OPR\/([\d.]+)/)))             browser = 'Opera ' + m[1];
        else if ((m = ua.match(/Firefox\/([\d.]+)/)))         browser = 'Firefox ' + m[1];
        else if ((m = ua.match(/Chrome\/([\d.]+)/)))          browser = 'Chrome ' + m[1];
        else if ((m = ua.match(/Version\/([\d.]+).*Safari/))) browser = 'Safari ' + m[1];

        var os = 'Unknown OS';
        if (/Windows/.test(ua))                 os = 'Windows';
        else if (/Mac OS X/.test(ua))           os = 'macOS';
        else if (/Android/.test(ua))            os = 'Android';
        else if (/iPhone|iPad|iPod/.test(ua))   os = 'iOS';
        else if (/Linux/.test(ua))              os = 'Linux';

        return browser + ' / ' + os;
    }

    // Pull the pixel font in only when someone is actually blocked.
    function loadPixelFont() {
        var pre = document.createElement('link');
        pre.rel = 'preconnect';
        pre.href = 'https://fonts.gstatic.com';
        pre.crossOrigin = '';
        document.head.appendChild(pre);

        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
        document.head.appendChild(link);
    }

    /* ─── Verdict cache ──────────────────────────────────── */

    function readCache() {
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var c = JSON.parse(raw);
            if (!c || typeof c.at !== 'number') return null;
            if (Date.now() - c.at > CACHE_TTL_MS) {
                localStorage.removeItem(CACHE_KEY);
                return null;
            }
            return c;
        } catch (e) {
            return null;
        }
    }

    function writeCache(allowed, ip) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                allowed: !!allowed,
                ip: ip || null,
                at: Date.now()
            }));
        } catch (e) { /* private mode, fine */ }
    }

    /* ─── Scan sequence ──────────────────────────────────── */

    function buildLoader() {
        loader = document.createElement('div');
        loader.className = 'ipscan';
        loader.innerHTML =
            '<div class="ipscan-grid" aria-hidden="true"></div>' +
            '<div class="ipscan-scan" aria-hidden="true"></div>' +
            '<div class="ipscan-hex" id="ipscan-hex" aria-hidden="true"></div>' +
            '<div class="ipscan-inner">' +
                '<div class="ipscan-radar" aria-hidden="true">' +
                    '<span class="ipscan-ring"></span>' +
                    '<span class="ipscan-ring ipscan-ring2"></span>' +
                    '<span class="ipscan-sweep"></span>' +
                    '<span class="ipscan-cross"></span>' +
                    '<span class="ipscan-cross ipscan-cross-v"></span>' +
                '</div>' +
                '<p class="ipscan-title">VERIFYING IP<span class="ipscan-dots"></span></p>' +
                '<p class="ipscan-timer" id="ipscan-timer">T-30.0s</p>' +
                '<p class="ipscan-iplabel">ORIGIN SIGNATURE</p>' +
                '<p class="ipscan-ip" id="ipscan-ip"><span class="ipscan-ip-wait">SCANNING</span></p>' +
                '<div class="ipscan-log" id="ipscan-log"></div>' +
                '<div class="ipscan-bar"><div class="ipscan-bar-fill" id="ipscan-fill"></div></div>' +
                '<p class="ipscan-pct" id="ipscan-pct">0%</p>' +
                '<p class="ipscan-note" id="ipscan-note">' + esc(NOTES[0]) + '</p>' +
                '<p class="ipscan-verdict" id="ipscan-verdict"></p>' +
            '</div>';
        html.appendChild(loader);

        // Terminal lines type in one after another.
        var log = loader.querySelector('#ipscan-log');
        var step = (MIN_SCAN_MS - 900) / SCAN_LINES.length;
        SCAN_LINES.forEach(function (text, i) {
            setTimeout(function () {
                if (!log.isConnected) return;
                var row = document.createElement('p');
                row.innerHTML = '<span class="ipscan-caret">&gt;</span> ' + esc(text) +
                                '<span class="ipscan-ok">OK</span>';
                log.appendChild(row);
                log.scrollTop = log.scrollHeight;
            }, 200 + i * step);
        });

        // Reassurance, rotating and increasingly optimistic.
        var note = loader.querySelector('#ipscan-note');
        var noteIdx = 0;
        var noteTick = setInterval(function () {
            if (!note.isConnected) { clearInterval(noteTick); return; }
            noteIdx = (noteIdx + 1) % NOTES.length;
            note.style.opacity = '0';
            setTimeout(function () {
                if (!note.isConnected) return;
                note.textContent = NOTES[noteIdx];
                note.style.opacity = '';
            }, 260);
        }, MIN_SCAN_MS / NOTES.length);

        // Countdown readout.
        var timer = loader.querySelector('#ipscan-timer');
        var timerTick = setInterval(function () {
            if (!timer.isConnected) { clearInterval(timerTick); return; }
            var left = Math.max(0, MIN_SCAN_MS - (Date.now() - startedAt));
            timer.textContent = 'T-' + (left / 1000).toFixed(1) + 's';
            if (left <= 0) clearInterval(timerTick);
        }, 100);

        // Progress bar creeps toward 100 across the scan window.
        var fill = loader.querySelector('#ipscan-fill');
        var pct = loader.querySelector('#ipscan-pct');
        var t0 = Date.now();
        var tick = setInterval(function () {
            if (!fill.isConnected) { clearInterval(tick); return; }
            var p = Math.min(99, Math.round((Date.now() - t0) / MIN_SCAN_MS * 100));
            fill.style.width = p + '%';
            pct.textContent = p + '%';
        }, 40);

        // Hex garbage scrolling down both edges.
        var hex = loader.querySelector('#ipscan-hex');
        var hexTick = setInterval(function () {
            if (!hex.isConnected) { clearInterval(hexTick); return; }
            hex.textContent = hexRow() + '\n' + hex.textContent.split('\n').slice(0, 26).join('\n');
        }, 70);
    }

    // Drop the address in one character at a time, then let the whole string
    // ripple continuously.
    function revealIp(ip) {
        var host = loader && loader.querySelector('#ipscan-ip');
        if (!host) return;
        host.innerHTML = '';

        var chars = String(ip || 'UNKNOWN').split('');
        chars.forEach(function (ch, i) {
            setTimeout(function () {
                if (!host.isConnected) return;
                var span = document.createElement('span');
                span.className = 'ipscan-ip-char';
                span.style.setProperty('--i', i);
                span.textContent = ch;
                host.appendChild(span);
            }, i * 55);
        });
    }

    function removeLoader() {
        if (!loader) return;
        loader.classList.add('ipscan-out');
        var el = loader;
        loader = null;
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
    }

    /* ─── Verdicts ───────────────────────────────────────── */

    function grant(ip) {
        var verdict = loader && loader.querySelector('#ipscan-verdict');
        var fill = loader && loader.querySelector('#ipscan-fill');
        var pct = loader && loader.querySelector('#ipscan-pct');

        if (fill) fill.style.width = '100%';
        if (pct) pct.textContent = '100%';
        if (verdict) {
            verdict.textContent = 'ACCESS GRANTED';
            verdict.className = 'ipscan-verdict ipscan-granted';
        }
        if (loader) loader.classList.add('ipscan-flash');

        setTimeout(function () {
            removeLoader();
            html.classList.remove('ip-pending');
            // Cached only once the sequence has actually finished. Anyone who
            // leaves mid-scan gets a fresh check next time.
            writeCache(true, ip);
        }, 620);
    }

    function deny(ip) {
        var verdict = loader && loader.querySelector('#ipscan-verdict');
        if (verdict) {
            verdict.textContent = 'ACCESS DENIED';
            verdict.className = 'ipscan-verdict ipscan-refused';
        }
        if (loader) loader.classList.add('ipscan-reject');

        setTimeout(function () {
            removeLoader();
            showBlockScreen(ip);
            html.classList.remove('ip-pending');
            // Cached only once the sequence has actually finished. Anyone who
            // leaves mid-scan gets a fresh check next time.
            writeCache(false, ip);
        }, 700);
    }

    function showBlockScreen(ip) {
        loadPixelFont();

        // Neutralise the site's own body padding/background and stop the page
        // behind the block screen from scrolling. Without this, mobile shows a
        // strip of the real site below the overlay and the page scrolls.
        html.classList.add('ipgate-locked');

        var rank = RANKS[Math.floor(Math.random() * RANKS.length)];
        var d = new Date();
        var time = pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);

        document.body.innerHTML =
            '<div class="ipgate-arcade">' +
                '<div class="ipgate-scan" aria-hidden="true"></div>' +
                '<div class="ipgate-inner">' +

                    '<p class="ipgate-over">GAME OVER</p>' +
                    '<h1 class="ipgate-denied">ACCESS DENIED</h1>' +

                    '<div class="ipgate-ach">' +
                        '<span class="ipgate-ach-icon">&#128274;</span>' +
                        '<span>' +
                            '<span class="ipgate-ach-label">ACHIEVEMENT UNLOCKED</span>' +
                            '<span class="ipgate-ach-name">' + esc(rank) + '</span>' +
                        '</span>' +
                    '</div>' +

                    '<div class="ipgate-card">' +
                        '<p class="ipgate-card-title">PLAYER CARD</p>' +
                        '<p><span>PLAYER ID</span><b>' + esc(ip || 'UNKNOWN') + '</b></p>' +
                        '<p><span>LOADOUT</span><b>' + esc(browserInfo()) + '</b></p>' +
                        '<p><span>RANK</span><b>' + esc(rank) + '</b></p>' +
                        '<p><span>SCORE</span><b>000000</b></p>' +
                        '<p><span>LIVES</span><b>0</b></p>' +
                        '<p><span>TIME</span><b>' + esc(time) + '</b></p>' +
                    '</div>' +

                    '<div class="ipgate-bar-wrap">' +
                        '<p class="ipgate-bar-label">BYPASSING FIREWALL</p>' +
                        '<div class="ipgate-bar"><div class="ipgate-bar-fill"></div></div>' +
                        '<p class="ipgate-bar-pct">0%</p>' +
                    '</div>' +

                    '<p class="ipgate-start">&#9654; PRESS START TO CONTACT ADMIN</p>' +
                    '<p class="ipgate-coin">INSERT COIN</p>' +
                    '<p class="ipgate-ua">' + esc(navigator.userAgent) + '</p>' +

                '</div>' +
            '</div>';
    }

    // Hold the verdict until the scan animation has had its moment.
    function settle(fn, ip) {
        if (done) return;
        done = true;
        var waited = Date.now() - startedAt;
        setTimeout(function () { fn(ip); }, Math.max(0, MIN_SCAN_MS - waited));
    }

    /* ─── Go ─────────────────────────────────────────────── */

    var cached = readCache();
    if (cached) {
        // Verdict from the last hour: apply it instantly, no scan.
        done = true;
        if (cached.allowed) {
            html.classList.remove('ip-pending');
        } else if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                showBlockScreen(cached.ip);
                html.classList.remove('ip-pending');
            });
        } else {
            showBlockScreen(cached.ip);
            html.classList.remove('ip-pending');
        }
        return;
    }

    buildLoader();

    fetch('https://api64.ipify.org?format=json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var ip = data && data.ip;
            revealIp(ip);
            if (ip && ALLOWED_IPS.indexOf(ip) !== -1) {
                settle(grant, ip);
            } else {
                settle(deny, ip);
            }
        })
        .catch(function () { revealIp(null); settle(deny, null); });

    // Never leave the page hidden forever if the lookup hangs.
    setTimeout(function () { settle(deny, null); }, MIN_SCAN_MS + 5000);
})();
