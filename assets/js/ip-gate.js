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
    var ALLOWED_IPS = [
        '76.122.79.245',
        '2601:c4:c002:c10:789d:7f1d:7852:5873'
    ];

    var html = document.documentElement;
    var done = false;

    function ban() {
        if (done) return;
        done = true;
        document.body.innerHTML =
            '<div class="ipgate-banned">' +
                '<div>' +
                    '<p class="ipgate-title">Your IP has been banned.</p>' +
                    '<p class="ipgate-sub">Please contact admin.</p>' +
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
            if (data && ALLOWED_IPS.indexOf(data.ip) !== -1) {
                allow();
            } else {
                ban();
            }
        })
        .catch(ban);

    // Never leave the page hidden forever if the lookup hangs.
    setTimeout(function () { if (!done) ban(); }, 6000);
})();
