/**
 * ArtivicoLab beats: an original lo-fi boom-bap loop synthesized with Web Audio.
 * Same architecture as the Lingala ambient player: click-to-play only (no autoplay),
 * a look-ahead scheduler that hands the audio clock one bar at a time so the loop
 * is seamless, an iOS silent-switch workaround, and a 5-minute auto-stop.
 * No samples, no dependencies.
 */
(function () {
    'use strict';

    var btn = document.getElementById('beatsBtn');
    var glyph = document.getElementById('beatsGlyph');
    var prog = document.getElementById('beatsProg');
    if (!btn) return;

    var BPM = 84, BEAT = 60 / BPM, BARS = 32, DUR = BARS * 4 * BEAT;
    var LOOP_SECONDS = 300, LOOKAHEAD = 1.5, TICK_MS = 200;
    var SWING = 0.08; // delay on off-eighths, in beats

    var ctx = null, master = null, comp = null, playing = false, ticker = null;
    var sessionStart = 0, startTime = 0, nextBarTime = 0, curBar = 0, barBase = 0;
    var snareBuf = null, hatBuf = null, crackleSrc = null;
    var routerAudio = null, streamDest = null;

    // Note bank (Hz)
    var N = {
        D1: 36.71, G1: 49.00, C2: 65.41, A1: 55.00, F1: 43.65,
        D3: 146.83, F3: 174.61, A3: 220.00, C4: 261.63, G3: 196.00, B3: 246.94,
        E4: 329.63, G4: 392.00, A4: 440.00, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00
    };
    // Four-bar progression: Dm7, G7, Cmaj7, Am7 (roots for the bass, tones for the keys)
    var CHORDS = [
        { root: N.D1, tones: [N.D3, N.F3, N.A3, N.C4] },
        { root: N.G1, tones: [N.G3, N.B3, N.D3 * 2, N.F3 * 2] },
        { root: N.C2, tones: [N.C4, N.E4, N.G4, N.B3] },
        { root: N.A1, tones: [N.A3, N.C4, N.E4, N.G4] }
    ];
    var MELODY = [
        [N.A4, N.C5, N.D5, null, N.C5, null, N.A4, null],
        [N.G4, null, N.A4, N.C5, null, N.D5, null, null],
        [N.E5, N.D5, null, N.C5, null, N.A4, null, N.G4],
        [null, N.A4, null, null, N.C5, null, N.D5, null]
    ];

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    function noise(decay) {
        var len = Math.floor(ctx.sampleRate * 0.4);
        var b = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = b.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay));
        return b;
    }

    function at(off) { return barBase + off * BEAT; }
    function live(t) { return t >= ctx.currentTime - 0.05; }

    function kick(off, vol) {
        var t = at(off); if (!live(t)) return;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(115, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        o.connect(g); g.connect(comp);
        o.start(t); o.stop(t + 0.35);
    }

    function snare(off, vol) {
        var t = at(off); if (!live(t)) return;
        var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.9;
        g.gain.value = vol;
        s.buffer = snareBuf; s.connect(f); f.connect(g); g.connect(comp); s.start(t);
        var o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
        og.gain.setValueAtTime(vol * 0.6, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(og); og.connect(comp); o.start(t); o.stop(t + 0.14);
    }

    function hat(off, vol, open) {
        var t = at(off); if (!live(t)) return;
        var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'highpass'; f.frequency.value = open ? 6000 : 7500;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.28 : 0.06));
        s.buffer = hatBuf; s.connect(f); f.connect(g); g.connect(comp); s.start(t);
    }

    function tone(freq, off, durBeats, vol, type, cutoff, atk) {
        var t = at(off); if (!live(t)) return;
        var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t);
        f.type = 'lowpass'; f.frequency.value = cutoff;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + atk);
        g.gain.exponentialRampToValueAtTime(0.001, t + durBeats * BEAT);
        o.connect(f); f.connect(g); g.connect(comp);
        o.start(t); o.stop(t + durBeats * BEAT + 0.05);
    }

    function scheduleBar(bar, barTime) {
        barBase = barTime;
        var ch = CHORDS[bar % 4];
        var fade = bar >= 30 ? (BARS - bar) / 2 : 1;
        var drums = bar >= 4;
        var din = bar >= 4 && bar < 6 ? (bar - 4 + 1) / 2 : 1;

        // Keys: warm chord on the one, softer stab on the and-of-three
        ch.tones.forEach(function (f) {
            tone(f, 0, 2.6, 0.075 * fade, 'triangle', 1100, 0.04);
            tone(f, 2.5 + SWING, 1.1, 0.045 * fade, 'triangle', 900, 0.03);
        });

        if (drums) {
            // Boom-bap: kick 1 and and-of-2, snare 2 and 4
            kick(0, 0.55 * din * fade);
            kick(1.5 + SWING, 0.42 * din * fade);
            if (bar % 4 === 3) kick(3.5 + SWING, 0.35 * din * fade);
            snare(1, 0.42 * din * fade);
            snare(3, 0.42 * din * fade);
            if (bar % 8 === 7) snare(3.75, 0.18 * din * fade);
            // Swung hats
            for (var e = 0; e < 8; e++) {
                var off = e * 0.5 + (e % 2 === 1 ? SWING : 0);
                hat(off, (e % 2 === 0 ? 0.11 : 0.065) * din * fade, false);
            }
            if (bar % 2 === 1) hat(3.5 + SWING, 0.09 * din * fade, true);
            // Sub bass on the root
            tone(ch.root, 0, 1.4, 0.5 * din * fade, 'sine', 180, 0.01);
            tone(ch.root, 2.5 + SWING, 1.1, 0.4 * din * fade, 'sine', 180, 0.01);
            if (bar % 2 === 1) tone(ch.root * 1.5, 3.5 + SWING, 0.5, 0.3 * din * fade, 'sine', 200, 0.01);
        }

        // Sparse pluck melody, bars 12 to 28
        if (bar >= 12 && bar < 28) {
            var line = MELODY[Math.floor(bar / 2) % MELODY.length];
            for (var s = 0; s < 8; s++) {
                if (!line[s]) continue;
                tone(line[s], s * 0.5 + (s % 2 === 1 ? SWING : 0), 0.7, 0.07 * fade, 'triangle', 2600, 0.004);
            }
        }
    }

    function pump() {
        while (nextBarTime < ctx.currentTime + LOOKAHEAD) {
            scheduleBar(curBar, nextBarTime);
            nextBarTime += 4 * BEAT;
            curBar = (curBar + 1) % BARS;
        }
    }

    function setUI(on) {
        if (glyph) glyph.textContent = on ? '❚❚' : '►';
        btn.setAttribute('aria-label', on ? 'Pause beats' : 'Play beats');
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        document.documentElement.classList.toggle('sound-playing', on);
    }

    async function start() {
        if (playing) return true;
        var c = getCtx();
        try { await c.resume(); } catch (e) { /* ignore */ }
        if (c.state !== 'running' || playing) return false;
        try { localStorage.setItem('artivicolab.beats', 'on'); } catch (e) { /* ignore */ }

        master = c.createGain(); master.gain.value = 0.6;
        comp = c.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 4;
        comp.attack.value = 0.004; comp.release.value = 0.25;
        comp.connect(master);

        // Route through exactly one destination (MediaStream on iOS so the silent switch is ignored).
        var routed = false;
        if (typeof c.createMediaStreamDestination === 'function') {
            try {
                streamDest = c.createMediaStreamDestination();
                master.connect(streamDest);
                routerAudio = new Audio();
                routerAudio.playsInline = true;
                routerAudio.setAttribute('playsinline', '');
                routerAudio.srcObject = streamDest.stream;
                await routerAudio.play();
                routed = true;
            } catch (e) {
                try { master.disconnect(streamDest); } catch (e2) { /* ignore */ }
                streamDest = null; routerAudio = null;
            }
        }
        if (!routed) master.connect(c.destination);

        snareBuf = noise(0.03); hatBuf = noise(0.006);

        // Vinyl crackle bed: looping filtered noise, very quiet
        var len = Math.floor(c.sampleRate * 2), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = (Math.random() < 0.0015 ? (Math.random() * 2 - 1) : 0) * 0.8 + (Math.random() * 2 - 1) * 0.02;
        crackleSrc = c.createBufferSource(); crackleSrc.buffer = b; crackleSrc.loop = true;
        var cf = c.createBiquadFilter(); cf.type = 'lowpass'; cf.frequency.value = 3200;
        var cg = c.createGain(); cg.gain.value = 0.35;
        crackleSrc.connect(cf); cf.connect(cg); cg.connect(comp); crackleSrc.start();

        startTime = c.currentTime + 0.3;
        nextBarTime = startTime; curBar = 0;
        pump();

        sessionStart = c.currentTime;
        playing = true;
        setUI(true);
        ticker = setInterval(function () {
            if (ctx.currentTime - sessionStart >= LOOP_SECONDS) { stop(true); return; }
            pump();
            if (prog) {
                var pos = ctx.currentTime - startTime;
                if (pos >= 0) prog.style.width = ((pos % DUR) / DUR * 100).toFixed(1) + '%';
            }
        }, TICK_MS);
        return true;
    }

    function stop(auto) {
        clearInterval(ticker);
        playing = false;
        if (master) {
            try {
                var now = ctx.currentTime;
                master.gain.cancelScheduledValues(now);
                master.gain.setValueAtTime(master.gain.value, now);
                master.gain.linearRampToValueAtTime(0, now + (auto ? 0.8 : 0.4));
            } catch (e) { /* ignore */ }
        }
        if (crackleSrc) { try { crackleSrc.stop(ctx.currentTime + 1); } catch (e) { /* ignore */ } crackleSrc = null; }
        if (routerAudio) { try { setTimeout(function () { routerAudio.pause(); }, 900); } catch (e) { /* ignore */ } }
        setUI(false);
        if (prog) setTimeout(function () { prog.style.width = '0%'; }, auto ? 1200 : 400);
    }

    btn.addEventListener('click', function () {
        if (playing) {
            stop(false);
            try { localStorage.setItem('artivicolab.beats', 'off'); } catch (e) { /* ignore */ }
        } else {
            start();
        }
    });
    // No autoplay by design: the beat starts only from this button.
})();
