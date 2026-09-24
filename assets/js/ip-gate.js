/**
 * ArtivicoLab, Visitor Scan.
 *
 * A demo, not a gate. Nothing on this site is ever blocked by this file.
 * It is here so a visitor can see the kind of interaction the lab builds:
 * a live device readout, a staged scan sequence, and an arcade refusal
 * screen with its own continue loop, all running in the browser with no
 * server behind it.
 *
 * It never runs on its own. The visitor launches it from the footer
 * button, or with ?scan=1 in the URL, and every screen it opens has a way
 * out that restores the page untouched.
 *
 * Earlier this file was a real attempt at an IP allowlist. It was never
 * access control, because a static host cannot check anything before it
 * serves the file, and it is not pretending to be one now.
 */
(function () {
    'use strict';

    // Which ending the demo plays. Nothing about the visitor decides
    // this, they pick it themselves.
    var MODE_WELCOME = 'welcome';
    var MODE_REFUSED = 'refused';

    // How long the scan runs before showing a verdict, even if the IP lookup
    // came back sooner. The result is cached (see below) so this only plays
    // once an hour, not on every page load.
    var MIN_SCAN_MS = 22000;

    // Arcade loop for blocked visitors. Three denials burn the three lives,
    // and the fourth screen asks for the magic word instead. Getting it right
    // buys a short guest pass. None of this is security: the word is sitting
    // right here in a file anyone can read.
    var LIVES_KEY = 'artivicolab_ipgate_lives_v1';
    var PASS_KEY = 'artivicolab_ipgate_pass_v1';
    var START_LIVES = 3;
    var PASS_MS = 5 * 60 * 1000;
    var MAGIC_WORD = 'please';

    var SNARK = [
        'NOT THE WORD. TRY MANNERS.',
        'STILL NO. SOMEBODY TAUGHT YOU THIS ONE.',
        'ONE WORD. SIX LETTERS. VERY POLITE.',
        'YOU ARE OVERTHINKING A DOOR.'
    ];


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

    /* ─── Demo state ─────────────────────────────────────── */

    // All of this lives in memory for the length of one demo run. Nothing
    // is written to storage, because nothing here has to survive a reload:
    // the site is never gated, so there is no verdict worth remembering.

    var lives = START_LIVES;
    var passUntil = 0;
    var passBadge = null;

    function readLives() { return lives; }
    function writeLives(n) { lives = Math.max(0, n); }

    function grantPass() {
        passUntil = Date.now() + PASS_MS;
        writeLives(START_LIVES);       // the loop resets, so it is earned again
        closeOverlay();                // out of the arcade, back to the site
        showPassTimer(passUntil);
    }

    function endPass() {
        passUntil = 0;
        if (passBadge && passBadge.parentNode) {
            passBadge.classList.add('is-out');
            var el = passBadge;
            passBadge = null;
            setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 700);
        }
    }

    /* ─── Scan sequence ──────────────────────────────────── */

    // The scan runs as three short steps instead of one tall wall of
    // readouts. Only one step is on screen at a time, which is what keeps
    // the whole thing inside a phone without scrolling.
    var STEP_2_AT = 6600;
    var STEP_3_AT = 16000;

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
            // Radar stays up for the whole scan, large and faint, with the
            // steps reading on top of it.
            '<div class="ipscan-radar ipscan-radar--bg" aria-hidden="true">' +
                '<span class="ipscan-ring"></span>' +
                '<span class="ipscan-ring ipscan-ring2"></span>' +
                '<span class="ipscan-ring ipscan-ring3"></span>' +
                '<span class="ipscan-sweep"></span>' +
                '<span class="ipscan-cross"></span>' +
                '<span class="ipscan-cross ipscan-cross-v"></span>' +
            '</div>' +
            '<div class="ipscan-inner">' +

                '<div class="ipscan-head">' +
                    '<span class="ipscan-stepname" id="ipscan-stepname">' + STEP_NAMES[0] + '</span>' +
                    '<span class="ipscan-timer" id="ipscan-timer">T-30.0s</span>' +
                '</div>' +

                '<div class="ipscan-steps">' +

                    '<section class="ipscan-step is-on">' +
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
            // The habitat clause only appears once the lookup lands. Saying
            // "observed habitat pending" just reads as broken.
            sub.textContent = geo.city
                ? race + '. Observed ' + geo.city + ', ' + (geo.region || 'parts unknown') + '.'
                : race + '.';
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

    /* ─── Launch button ──────────────────────────────────── */

    // The only way in. Sits next to the footer play button and says plainly
    // what it is, so nobody clicks it expecting a security check.
    function injectLaunchButton() {
        function place() {
            if (document.getElementById('ipgate-reset')) return;
            var beats = document.getElementById('beatsBtn');
            var container = document.querySelector('.footer .container');
            if (!beats && !container) return;

            var btn = document.createElement('button');
            btn.id = 'ipgate-reset';
            btn.type = 'button';
            btn.className = 'ipgate-reset';
            btn.title = 'Run the visitor scan demo. Nothing on this site is gated.';
            btn.innerHTML = '<span aria-hidden="true">&#9673;</span> VISITOR SCAN';
            btn.addEventListener('click', function () { startDemo(MODE_WELCOME); });

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
            showOutro(ip);
        }, 620);
    }

    // What the visitor sees when the welcome ending finishes: a plain
    // statement of what just happened, and the choice to see the other
    // ending rather than being handed it.
    function showOutro(ip) {
        var wrap = document.createElement('div');
        wrap.className = 'ipdemo-outro';
        wrap.innerHTML =
            '<div class="ipdemo-outro-card">' +
                '<p class="ipdemo-outro-kicker">SCAN COMPLETE</p>' +
                '<h2 class="ipdemo-outro-title">Access granted.<br>It always was.</h2>' +
                '<p class="ipdemo-outro-body">Nothing on this site is gated. That sequence read ' +
                'your browser out loud, looked up roughly where your connection sits, and ' +
                'ran entirely in this tab. No server, no account, no record kept.</p>' +
                '<p class="ipdemo-outro-body">This is the sort of thing the lab builds: ' +
                'a whole interaction, start to finish, out of flat files.</p>' +
                '<div class="ipdemo-outro-actions">' +
                    '<button type="button" class="ipdemo-btn ipdemo-btn--primary" id="ipdemo-enter">Back to the site</button>' +
                    '<button type="button" class="ipdemo-btn" id="ipdemo-refused">Run it again, refuse me</button>' +
                '</div>' +
                '<p class="ipdemo-outro-note">The refusal screen is a demo too. It cannot keep you out.</p>' +
            '</div>';
        document.body.appendChild(wrap);
        lockScroll(true);
        overlay = wrap;

        wrap.querySelector('#ipdemo-enter').addEventListener('click', closeOverlay);
        wrap.querySelector('#ipdemo-refused').addEventListener('click', function () {
            closeOverlay();
            startDemo(MODE_REFUSED);
        });
        wrap.addEventListener('click', function (ev) { if (ev.target === wrap) closeOverlay(); });
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
            showBlockScreen(ip, true);
        }, 700);
    }

    // Nobody can guess a word they were never shown, so the letters go up
    // scrambled and they unscramble them.
    function scramble(word) {
        var letters = word.toUpperCase().split('');
        var out, guard = 0;
        do {
            for (var i = letters.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var t = letters[i]; letters[i] = letters[j]; letters[j] = t;
            }
            out = letters.join('');
            guard++;
        } while (out === word.toUpperCase() && guard < 20);
        return out;
    }

    /* ─── Overlays ───────────────────────────────────────── */

    // Every demo screen is an overlay on top of the untouched page. The old
    // version replaced document.body.innerHTML, which is fine for a gate
    // that never intends to let you back, and useless for a demo.

    var overlay = null;

    function lockScroll(on) {
        html.classList.toggle('ipdemo-locked', !!on);
    }

    function closeOverlay() {
        if (!overlay) return;
        var el = overlay;
        overlay = null;
        el.classList.add('is-leaving');
        lockScroll(false);
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 320);
    }

    // Escape always works, on every screen this file opens.
    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') {
            if (overlay) closeOverlay();
            else if (loader) { done = true; removeLoader(); lockScroll(false); }
        }
    });

    function showBlockScreen(ip, spendLife) {
        loadPixelFont();

        // Neutralise the site's own body padding/background and stop the page
        // behind the block screen from scrolling. Without this, mobile shows a
        // strip of the real site below the overlay and the page scrolls.

        var lives = readLives();
        if (spendLife && lives > 0) {
            lives = lives - 1;
            writeLives(lives);
        }
        var outOfLives = lives <= 0;

        var rank = RANKS[Math.floor(Math.random() * RANKS.length)];
        var d = new Date();
        var time = pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);

        var host = document.createElement('div');
        host.className = 'ipdemo-overlay';
        host.innerHTML =
            '<div class="ipgate-arcade' + (outOfLives ? ' is-word' : '') + '">' +
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
                        '<p><span>LIVES</span><b>' + (outOfLives ? '0' :
                            new Array(lives + 1).join('&#9829; ')) + '</b></p>' +
                        '<p><span>TIME</span><b>' + esc(time) + '</b></p>' +
                    '</div>' +

                    '<div class="ipgate-bar-wrap">' +
                        '<p class="ipgate-bar-label">BYPASSING FIREWALL</p>' +
                        '<div class="ipgate-bar"><div class="ipgate-bar-fill"></div></div>' +
                        '<p class="ipgate-bar-pct">0%</p>' +
                    '</div>' +

                    (outOfLives
                        ? '<form class="ipgate-word" id="ipgate-word">' +
                              '<p class="ipgate-word-label">&#9733; CONTINUE? &#9733;</p>' +
                              '<p class="ipgate-word-hint">THIS DOOR RESPONDS TO MANNERS.<br>UNSCRAMBLE THE WORD.</p>' +
                              '<p class="ipgate-word-tiles">' +
                                  scramble(MAGIC_WORD).split('').map(function (ch) {
                                      return '<span>' + esc(ch) + '</span>';
                                  }).join('') +
                              '</p>' +
                              '<input class="ipgate-word-input" id="ipgate-word-input" type="text" ' +
                                  'autocomplete="off" autocorrect="off" spellcheck="false" ' +
                                  'maxlength="16" placeholder="TYPE IT" aria-label="The magic word">' +
                              '<button type="submit" class="ipgate-word-go">ENTER</button>' +
                              '<p class="ipgate-word-msg" id="ipgate-word-msg"></p>' +
                          '</form>'
                        : '<button type="button" class="ipgate-retry" id="ipgate-retry">&#8635; RETRY SCAN &middot; ' +
                          lives + ' LEFT</button>') +
                    '<p class="ipgate-start">&#9654; PRESS START TO CONTACT ADMIN</p>' +
                    '<p class="ipgate-coin">INSERT COIN</p>' +
                    '<p class="ipgate-curator">ARTIVICOLAB &middot; ATLANTA<br>' +
                    'GAME BY <b>GRADI KAYAMBA</b></p>' +
                    '<p class="ipgate-ua">' + esc(navigator.userAgent) + '</p>' +
                    '<button type="button" class="ipgate-exit" id="ipgate-exit">' +
                        'EXIT DEMO &middot; NOTHING IS ACTUALLY BLOCKED</button>' +

                '</div>' +
            '</div>';
        document.body.appendChild(host);
        lockScroll(true);
        overlay = host;

        var exit = document.getElementById('ipgate-exit');
        if (exit) exit.addEventListener('click', closeOverlay);

        var retry = document.getElementById('ipgate-retry');
        if (retry) {
            retry.addEventListener('click', function () {
                closeOverlay();
                startDemo(MODE_REFUSED);
            });
        }

        var form = document.getElementById('ipgate-word');
        if (form) {
            var input = document.getElementById('ipgate-word-input');
            var msg = document.getElementById('ipgate-word-msg');
            var wrong = 0;

            form.addEventListener('submit', function (ev) {
                ev.preventDefault();
                var said = (input.value || '').trim().toLowerCase().replace(/[.!]+$/, '');

                if (said === MAGIC_WORD) {
                    msg.textContent = 'WELL MANNERED. 5 MINUTE PASS GRANTED.';
                    msg.className = 'ipgate-word-msg is-good';
                    form.classList.add('is-good');
                    setTimeout(grantPass, 900);
                    return;
                }

                msg.textContent = SNARK[wrong % SNARK.length];
                msg.className = 'ipgate-word-msg is-bad';
                wrong++;
                form.classList.remove('is-shake');
                void form.offsetWidth;          // restart the shake
                form.classList.add('is-shake');
                input.select();
            });

            setTimeout(function () { try { input.focus(); } catch (e) { /* ignore */ } }, 400);
        }
    }

    /* ─── Guest pass ─────────────────────────────────────── */

    // A visible countdown while the pass is live. When it runs out the page
    // reloads, which drops the visitor back onto the block screen.
    // Line the badge up with the site name, without covering the menu button
    // or the nav links. Vertical placement uses the header's height rather
    // than its live position, so scrolling cannot throw it off screen.
    function placePassBadge(badge) {
        var header = document.querySelector('.header');
        var cont = document.querySelector('.header .container');
        if (!header || !cont) return;   // leave the stylesheet default in place

        var bw = badge.offsetWidth;
        var bh = badge.offsetHeight;
        var hh = header.offsetHeight;
        var contRect = cont.getBoundingClientRect();

        var right = Math.max(8, Math.round(window.innerWidth - contRect.right));
        var left = window.innerWidth - right - bw;
        var top = Math.round((hh - bh) / 2);

        // Anything in the header the visitor needs to click or read.
        var blockers = ['.header .hamburger', '.header .nav-menu', '.header .logo'];
        for (var i = 0; i < blockers.length; i++) {
            var el = document.querySelector(blockers[i]);
            if (!el) continue;
            var r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;            // hidden at this width
            if (r.right > left - 10 && r.left < left + bw + 10) {
                // No clear space on the header line, so sit just below it.
                top = hh + 8;
                break;
            }
        }

        badge.style.top = Math.max(6, top) + 'px';
        badge.style.right = right + 'px';
    }

    function showPassTimer(until) {
        var badge = document.createElement('div');
        badge.className = 'ipgate-pass';
        badge.innerHTML = '<span class="ipgate-pass-label">GUEST PASS</span>' +
                          '<span class="ipgate-pass-clock" id="ipgate-pass-clock">5:00</span>';
        document.body.appendChild(badge);
        passBadge = badge;

        placePassBadge(badge);
        window.addEventListener('resize', function () { placePassBadge(badge); });

        var clock = badge.querySelector('#ipgate-pass-clock');
        var tick = setInterval(function () {
            var left = until - Date.now();
            if (left <= 0) {
                clearInterval(tick);
                clock.textContent = '0:00';
                endPass();
                return;
            }
            var total = Math.ceil(left / 1000);
            clock.textContent = Math.floor(total / 60) + ':' + pad(total % 60, 2);
            badge.classList.toggle('is-low', left <= 60000);
        }, 250);
    }

    // Hold the verdict until the scan animation has had its moment.
    function settle(fn, ip) {
        if (done) return;
        done = true;
        var waited = Date.now() - startedAt;
        setTimeout(function () { fn(ip); }, Math.max(0, MIN_SCAN_MS - waited));
    }

    /* ─── Go ─────────────────────────────────────────────── */

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else { fn(); }
    }

    // Runs only when asked. `mode` decides the ending, and the visitor
    // chooses it: the footer button plays the welcome, the outro offers the
    // refusal, and ?scan=refused links straight to it.
    function startDemo(mode) {
        if (loader || overlay) return;        // one screen at a time
        done = false;
        startedAt = Date.now();
        lives = START_LIVES;

        // Both endings play the full sequence. The refusal is worth nothing
        // without the build up in front of it.
        var ending = (mode === MODE_REFUSED) ? deny : grant;

        buildLoader();
        lockScroll(true);
        classifySpecimen();
        startDossier();
        lookupGeo();

        lookupIp(function (ip) {
            revealIp(ip);
            settle(ending, ip);
        });

        // If the lookup hangs, the demo still finishes rather than sitting there.
        setTimeout(function () { settle(ending, null); }, MIN_SCAN_MS + 5000);
    }

    function lookupIp(fn) {
        fetch('https://api64.ipify.org?format=json')
            .then(function (r) { return r.json(); })
            .then(function (data) { fn(data && data.ip); })
            .catch(function () { fn(null); });
    }

    // Readout only. Nothing here decides anything, so a failure just leaves
    // those rows unresolved.
    function lookupGeo() {
        fetch('https://ipwho.is/')
            .then(function (r) { return r.json(); })
            .then(function (g) {
                if (!g || g.success === false) return;
                geo.city    = g.city || 'unknown';
                geo.region  = g.region || 'unknown';
                geo.country = g.country || 'unknown';
                geo.isp     = (g.connection && (g.connection.isp || g.connection.org)) || 'unknown';
                geo.coords  = (g.latitude != null && g.longitude != null)
                    ? Number(g.latitude).toFixed(3) + ', ' + Number(g.longitude).toFixed(3)
                    : 'unknown';
                applyGeo();
            })
            .catch(function () { /* readout only, ignore */ });
    }

    // The page is never covered and never gated. All this does on load is
    // offer the button.
    html.classList.remove('ip-pending');
    injectLaunchButton();

    onReady(function () {
        var want = (new URLSearchParams(location.search)).get('scan');
        if (want === 'refused') startDemo(MODE_REFUSED);
        else if (want) startDemo(MODE_WELCOME);
    });
})();
