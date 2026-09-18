/**
 * Client-side IP gate.
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

        return browser + ' on ' + os;
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function ban(ip) {
        if (done) return;
        done = true;
        document.body.innerHTML =
            '<div class="ipgate-banned">' +
                '<div>' +
                    '<p class="ipgate-title">Your IP has been banned.</p>' +
                    '<p class="ipgate-sub">Please contact admin.</p>' +
                    '<div class="ipgate-meta">' +
                        '<p><span>IP</span> ' + esc(ip || 'unknown') + '</p>' +
                        '<p><span>Browser</span> ' + esc(browserInfo()) + '</p>' +
                        '<p><span>Time</span> ' + esc(new Date().toString()) + '</p>' +
                    '</div>' +
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
