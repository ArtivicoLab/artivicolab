/**
 * Client-side IP gate, arcade edition.
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

    // Edit this list to change who gets in.
    //
    // Currently set to a dummy address: 203.0.113.1 is reserved by RFC 5737
    // for documentation and is never assigned to a real host, so nothing on
    // the internet can match it. Effect: everyone is blocked, including the
    // site owner.
    //
    // To let yourself back in, replace the dummy below with your own IP
    // (find it at https://api64.ipify.org), or run scripts/remove-ip-gate.sh
    // to strip the gate out entirely.
    var ALLOWED_IPS = [
        '203.0.113.1'
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

    var html = document.documentElement;
    var done = false;

    // Readable browser + OS from the user agent, for the block screen.
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

    // Pull the pixel font in only when someone is actually blocked, so
    // allowed visitors never pay for it.
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

    function ban(ip) {
        if (done) return;
        done = true;

        loadPixelFont();

        var rank = RANKS[Math.floor(Math.random() * RANKS.length)];
        var d = new Date();
        var time = pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);

        document.body.innerHTML =
            '<div class="ipgate-arcade">' +
                '<div class="ipgate-scan" aria-hidden="true"></div>' +
                '<div class="ipgate-inner">' +

                    '<p class="ipgate-over">GAME OVER</p>' +
                    '<h1 class="ipgate-denied" data-text="ACCESS DENIED">ACCESS DENIED</h1>' +

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

        html.classList.remove('ip-pending');
    }

    function allow() {
        if (done) return;
        done = true;
        html.classList.remove('ip-pending');
    }

    fetch('https://api64.ipify.org?format=json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var ip = data && data.ip;
            if (ip && ALLOWED_IPS.indexOf(ip) !== -1) {
                allow();
            } else {
                ban(ip);
            }
        })
        .catch(function () { ban(null); });

    // Never leave the page hidden forever if the lookup hangs.
    setTimeout(function () { if (!done) ban(null); }, 6000);
})();
