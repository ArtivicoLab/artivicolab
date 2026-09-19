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

    // Everything the browser will tell us about itself, no API needed.
    function deviceInfo() {
        var ua = navigator.userAgent;
        var n = navigator;

        var device = 'Desktop';
        if (/iPad|Tablet/i.test(ua)) device = 'Tablet';
        else if (/Mobi|iPhone|Android/i.test(ua)) device = 'Mobile';

        var model = 'Generic';
        if (/iPhone/i.test(ua))       model = 'iPhone';
        else if (/iPad/i.test(ua))    model = 'iPad';
        else if (/Macintosh/i.test(ua)) model = 'Mac';
        else if (/Android/i.test(ua)) model = 'Android device';
        else if (/Windows/i.test(ua)) model = 'Windows PC';
        else if (/Linux/i.test(ua))   model = 'Linux box';

        var conn = n.connection || n.mozConnection || n.webkitConnection;

        var tz = 'unknown';
        try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'; } catch (e) { /* ignore */ }

        return {
            device:   device + ' / ' + model,
            os:       browserInfo().split(' / ')[1] || 'unknown',
            browser:  browserInfo().split(' / ')[0] || 'unknown',
            screen:   screen.width + ' x ' + screen.height + ' @ ' + (window.devicePixelRatio || 1) + 'x',
            viewport: window.innerWidth + ' x ' + window.innerHeight,
            depth:    (screen.colorDepth || '?') + '-bit colour',
            tz:       tz,
            lang:     (n.languages && n.languages.join(', ')) || n.language || 'unknown',
            cores:    (n.hardwareConcurrency || '?') + ' logical',
            memory:   n.deviceMemory ? n.deviceMemory + ' GB' : 'undisclosed',
            touch:    (n.maxTouchPoints || 0) + ' touch points',
            conn:     conn && conn.effectiveType ? conn.effectiveType.toUpperCase() : 'unknown',
            referrer: document.referrer ? document.referrer.replace(/^https?:\/\//, '').slice(0, 42) : 'direct'
        };
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

    // The scan runs as three short steps instead of one tall wall of
    // readouts. Only one step is on screen at a time, which is what keeps
    // the whole thing inside a phone without scrolling.
    var STEP_2_AT = 9000;
    var STEP_3_AT = 22000;

    var STEP_NAMES = [
        'STEP 1 OF 3 &middot; ACQUIRING SIGNAL',
        'STEP 2 OF 3 &middot; DEVICE SWEEP',
        'STEP 3 OF 3 &middot; CLASSIFICATION'
    ];

    // A stable, official looking catalogue number for this visitor.
    function accession() {
        var seed = navigator.userAgent + '|' + screen.width + 'x' + screen.height;
        var h = 0;
        for (var i = 0; i < seed.length; i++) {
            h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
        }
        var d = new Date();
        var stamp = d.getFullYear() +
                    ('0' + (d.getMonth() + 1)).slice(-2) +
                    ('0' + d.getDate()).slice(-2);
        return 'ARTV-' + stamp + '-' + ('000' + (h >>> 16).toString(16).toUpperCase()).slice(-4);
    }

    function showStep(n) {
        if (!loader) return;
        var steps = loader.querySelectorAll('.ipscan-step');
        for (var i = 0; i < steps.length; i++) {
            steps[i].classList.toggle('is-on', i === n - 1);
        }
        var name = loader.querySelector('#ipscan-stepname');
        if (name) name.innerHTML = STEP_NAMES[n - 1];
    }

    function buildLoader() {
        loader = document.createElement('div');
        loader.className = 'ipscan';
        loader.innerHTML =
            '<div class="ipscan-grid" aria-hidden="true"></div>' +
            '<div class="ipscan-scan" aria-hidden="true"></div>' +
            '<div class="ipscan-hex" id="ipscan-hex" aria-hidden="true"></div>' +
            '<div class="ipscan-inner">' +

                '<div class="ipscan-head">' +
                    '<span class="ipscan-stepname" id="ipscan-stepname">' + STEP_NAMES[0] + '</span>' +
                    '<span class="ipscan-timer" id="ipscan-timer">T-30.0s</span>' +
                '</div>' +

                '<div class="ipscan-steps">' +

                    '<section class="ipscan-step is-on">' +
                        '<div class="ipscan-radar" aria-hidden="true">' +
                            '<span class="ipscan-ring"></span>' +
                            '<span class="ipscan-ring ipscan-ring2"></span>' +
                            '<span class="ipscan-sweep"></span>' +
                            '<span class="ipscan-cross"></span>' +
                            '<span class="ipscan-cross ipscan-cross-v"></span>' +
                        '</div>' +
                        '<p class="ipscan-title">VERIFYING IP<span class="ipscan-dots"></span></p>' +
                        '<p class="ipscan-iplabel">ORIGIN SIGNATURE</p>' +
                        '<p class="ipscan-ip" id="ipscan-ip"><span class="ipscan-ip-wait">SCANNING</span></p>' +
                    '</section>' +

                    '<section class="ipscan-step">' +
                        '<div class="ipscan-dossier" id="ipscan-dossier"></div>' +
                    '</section>' +

                    '<section class="ipscan-step">' +
                        '<div class="ipscan-specimen">' +
                            '<p class="ipscan-specimen-kicker">SPECIMEN CLASSIFICATION</p>' +
                            '<p class="ipscan-specimen-name" id="ipscan-species">Homo staticus</p>' +
                            '<p class="ipscan-specimen-sub" id="ipscan-species-sub"></p>' +
                            '<p class="ipscan-specimen-rule" aria-hidden="true"></p>' +
                            '<p class="ipscan-specimen-org">ARTIVICOLAB FIELD STATION 01 &middot; ATLANTA</p>' +
                            '<p class="ipscan-specimen-curator">Catalogued by <b>GRADI KAYAMBA</b>, Curator</p>' +
                            '<p class="ipscan-specimen-acc">ACCESSION ' + esc(accession()) + '</p>' +
                        '</div>' +
                        // Deliberately microscopic, in the finest tradition of fine print.
                        '<p class="ipscan-fineprint">NOTICE: The foregoing readout is provided for ' +
                        'entertainment and demonstrative purposes only and constitutes neither ' +
                        'surveillance nor data collection. All values displayed are read live from ' +
                        'your own browser at render time, held in volatile memory for the duration ' +
                        'of this animation, and discarded when this overlay closes. Nothing is ' +
                        'recorded, stored, sold, or retained by ArtivicoLab. Approximate location ' +
                        'and network provider are resolved by a third party address lookup and are ' +
                        'accurate to the city at best, frequently not even that. No cookies are set ' +
                        'by this notice. Your browser volunteered every one of these details without ' +
                        'being asked, which is in fact the entire point being made here.</p>' +
                    '</section>' +

                '</div>' +

                '<div class="ipscan-foot">' +
                    '<p class="ipscan-logline" id="ipscan-logline"></p>' +
                    '<div class="ipscan-bar"><div class="ipscan-bar-fill" id="ipscan-fill"></div></div>' +
                    '<p class="ipscan-pct" id="ipscan-pct">0%</p>' +
                    '<p class="ipscan-note" id="ipscan-note">' + esc(NOTES[0]) + '</p>' +
                    '<p class="ipscan-verdict" id="ipscan-verdict"></p>' +
                '</div>' +

            '</div>';
        html.appendChild(loader);

        // Advance through the steps.
        setTimeout(function () { showStep(2); }, STEP_2_AT);
        setTimeout(function () { showStep(3); }, STEP_3_AT);

        // One status line at a time, replacing the old scrolling terminal box.
        var logline = loader.querySelector('#ipscan-logline');
        var step = (MIN_SCAN_MS - 900) / SCAN_LINES.length;
        SCAN_LINES.forEach(function (text, i) {
            setTimeout(function () {
                if (!logline.isConnected) return;
                logline.innerHTML = '<span class="ipscan-caret">&gt;</span> ' + esc(text) +
                                    '<span class="ipscan-ok">OK</span>';
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
                host.appendChild(document.createElement('wbr'));
            }, i * 55);
        });
    }

    /* ─── The dossier ────────────────────────────────────

       Everything the browser volunteers about itself, read back to the
       visitor one line at a time. None of it is stored or sent anywhere.
       The geo rows fill in from a public lookup if it answers in time.  */

    var geo = {};                  // filled by the lookup below
    var pendingGeoRows = {};       // rows already on screen, waiting on geo

    function setRowValue(row, value) {
        var out = row.querySelector('.ipscan-row-val');
        out.textContent = '';
        String(value).split('').forEach(function (ch, i) {
            var sp = document.createElement('span');
            sp.className = 'ipscan-row-char';
            sp.style.setProperty('--i', i);
            sp.textContent = ch;
            out.appendChild(sp);
            out.appendChild(document.createElement('wbr'));
        });
    }

    function applyGeo() {
        Object.keys(pendingGeoRows).forEach(function (key) {
            if (geo[key]) {
                setRowValue(pendingGeoRows[key], geo[key]);
                delete pendingGeoRows[key];
            }
        });
        if (specimenPaint) specimenPaint();
    }

    // A taxonomy joke, keyed off whatever the visitor actually turned up on.
    function classifySpecimen() {
        var sub = loader && loader.querySelector('#ipscan-species-sub');
        if (!sub) return;

        var d = deviceInfo();
        var race;
        if (/Mobile/.test(d.device))      race = 'subsp. pollicaris, the thumb scroller';
        else if (/Tablet/.test(d.device)) race = 'subsp. reclinatus, scrolls lying down';
        else                              race = 'subsp. sedentarius, two hands, one chair';

        function paint() {
            var where = geo.city ? geo.city + ', ' + (geo.region || 'parts unknown') : 'habitat pending';
            sub.textContent = race + '. Observed ' + where + '.';
        }
        paint();
        specimenPaint = paint;   // geo lookup calls this again once it lands
    }

    var specimenPaint = null;

    function startDossier() {
        var host = loader && loader.querySelector('#ipscan-dossier');
        if (!host) return;

        var d = deviceInfo();
        var fields = [
            ['DEVICE',        d.device],
            ['OPERATING SYS', d.os],
            ['BROWSER',       d.browser],
            ['DISPLAY',       d.screen],
            ['VIEWPORT',      d.viewport],
            ['COLOUR',        d.depth],
            ['TIME ZONE',     d.tz],
            ['LANGUAGE',      d.lang],
            ['PROCESSOR',     d.cores],
            ['MEMORY',        d.memory],
            ['INPUT',         d.touch],
            ['NETWORK',       d.conn],
            ['ARRIVED FROM',  d.referrer],
            ['CITY',          { geo: 'city' }],
            ['REGION',        { geo: 'region' }],
            ['COUNTRY',       { geo: 'country' }],
            ['PROVIDER',      { geo: 'isp' }],
            ['COORDINATES',   { geo: 'coords' }]
        ];

        var window_ms = STEP_3_AT - STEP_2_AT - 900;
        var step = window_ms / fields.length;

        fields.forEach(function (field, i) {
            setTimeout(function () {
                if (!host.isConnected) return;

                var row = document.createElement('div');
                row.className = 'ipscan-row';
                row.innerHTML = '<span class="ipscan-row-key">' + esc(field[0]) + '</span>' +
                                '<span class="ipscan-row-val"></span>';
                host.appendChild(row);

                if (field[1] && field[1].geo) {
                    var key = field[1].geo;
                    if (geo[key]) {
                        setRowValue(row, geo[key]);
                    } else {
                        setRowValue(row, 'RESOLVING');
                        pendingGeoRows[key] = row;
                    }
                } else {
                    setRowValue(row, field[1] || 'unknown');
                }

                host.scrollTop = host.scrollHeight;
            }, STEP_2_AT + 300 + i * step);
        });
    }

    function removeLoader() {
        if (!loader) return;
        loader.classList.add('ipscan-out');
        var el = loader;
        loader = null;
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
    }

    /* ─── Rescan button ──────────────────────────────────── */

    // Sits next to the footer play button. Clears the cached verdict so the
    // scan runs again on reload, which is the only way to re-trigger it
    // before the one hour expiry.
    function injectResetButton() {
        function place() {
            if (document.getElementById('ipgate-reset')) return;
            var beats = document.getElementById('beatsBtn');
            var container = document.querySelector('.footer .container');
            if (!beats && !container) return;

            var btn = document.createElement('button');
            btn.id = 'ipgate-reset';
            btn.type = 'button';
            btn.className = 'ipgate-reset';
            btn.title = 'Clear the saved verification and run the IP scan again';
            btn.innerHTML = '<span aria-hidden="true">&#8635;</span> RESCAN IP';
            btn.addEventListener('click', function () {
                try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
                location.reload();
            });

            if (beats && beats.parentNode) {
                beats.parentNode.insertBefore(btn, beats.nextSibling);
            } else {
                container.insertBefore(btn, container.firstChild);
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', place);
        } else {
            place();
        }
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
            injectResetButton();
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

                    '<button type="button" class="ipgate-retry" id="ipgate-retry">&#8635; RETRY SCAN</button>' +
                    '<p class="ipgate-start">&#9654; PRESS START TO CONTACT ADMIN</p>' +
                    '<p class="ipgate-coin">INSERT COIN</p>' +
                    '<p class="ipgate-curator">ARTIVICOLAB &middot; ATLANTA<br>' +
                    'GAME BY <b>GRADI KAYAMBA</b></p>' +
                    '<p class="ipgate-ua">' + esc(navigator.userAgent) + '</p>' +

                '</div>' +
            '</div>';

        var retry = document.getElementById('ipgate-retry');
        if (retry) {
            retry.addEventListener('click', function () {
                try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
                location.reload();
            });
        }
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
            injectResetButton();
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
    classifySpecimen();
    startDossier();

    // Geo lookup purely for the readout. The allow/deny decision never
    // depends on it, so a failure here just leaves those rows unresolved.
    fetch('https://ipwho.is/')
        .then(function (r) { return r.json(); })
        .then(function (g) {
            if (!g || g.success === false) return;
            geo.city    = g.city || 'unknown';
            geo.region  = g.region || 'unknown';
            geo.country = g.country || 'unknown';   // no emoji: the per-char reveal splits surrogate pairs
            geo.isp     = (g.connection && (g.connection.isp || g.connection.org)) || 'unknown';
            geo.coords  = (g.latitude != null && g.longitude != null)
                ? Number(g.latitude).toFixed(3) + ', ' + Number(g.longitude).toFixed(3)
                : 'unknown';
            applyGeo();
        })
        .catch(function () { /* readout only, ignore */ });

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
