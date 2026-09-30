/**
 * ArtivicoLab beats: original loops synthesized with Web Audio. No samples,
 * no dependencies, nothing fetched. Three tracks live in the TRACKS table
 * below; the footer button on every page plays whichever one was chosen
 * last, and sounds.html lists them all with a download for each.
 *
 * Architecture, shared by every track: click-to-play only (no autoplay), a
 * look-ahead scheduler that hands the audio clock one bar at a time so the
 * loop is seamless, an iOS silent-switch workaround, and a 5-minute
 * auto-stop. Downloads render the same bar functions into an
 * OfflineAudioContext and pack the result as a 16-bit WAV in the tab.
 *
 * Adding a track: append an entry to TRACKS with an id (a dictionary word),
 * bpm, bar count, swing, and a bar(b) function that calls the instruments.
 * Everything else, the player, the picker, the download, picks it up.
 */
(function () {
    'use strict';

    var btn = document.getElementById('beatsBtn');
    var glyph = document.getElementById('beatsGlyph');
    var prog = document.getElementById('beatsProg');

    var LOOP_SECONDS = 300, LOOKAHEAD = 1.5, TICK_MS = 200;

    // Engine state. ctx/comp/barBase/BEAT/SWING are swapped out while a
    // download renders offline, so instruments must read them at call time.
    var ctx = null, master = null, comp = null, playing = false, ticker = null;
    var sessionStart = 0, startTime = 0, nextBarTime = 0, curBar = 0, barBase = 0;
    var BEAT = 0, SWING = 0, BARS = 0, DUR = 0;
    var snareBuf = null, hatBuf = null, bedSrc = null;
    var routerAudio = null, streamDest = null;
    var current = null, rendering = false, shownMix = null;
    var DEFAULT_TRACK = 'anthem'; // what a first-time visitor gets in the footer

    // Note bank (Hz)
    var N = {
        D1: 36.71, Db1: 34.65, Eb1: 38.89, E1: 41.20, F1: 43.65, G1: 49.00, Ab1: 51.91, A1: 55.00, B1: 61.74,
        C2: 65.41, D2: 73.42, E2: 82.41, G2: 98.00, Ab2: 103.83, A2: 110.00, B2: 123.47,
        C3: 130.81, Db3: 138.59, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.00, Ab3: 207.65,
        A3: 220.00, Bb3: 233.08, B3: 246.94, C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23,
        G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88, C5: 523.25, D5: 587.33, Eb5: 622.25,
        E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, Bb5: 932.33, B5: 987.77, C6: 1046.50, D6: 1174.66, E6: 1318.51, F6: 1396.91, G6: 1567.98,
        Gb4: 369.99, Gb5: 739.99, Gb3: 185.00
    };

    /* ── Instruments. `off` is a beat offset inside the current bar. ── */

    function noise(decay) {
        var len = Math.floor(ctx.sampleRate * 0.4);
        var b = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = b.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay));
        return b;
    }

    function at(off) { return barBase + off * BEAT; }
    function live(t) { return t >= ctx.currentTime - 0.05; }

    // o: { hi, lo, bend, dur } shape the pitch drop; defaults are the lo-fi kick.
    function kick(off, vol, o) {
        var t = at(off); if (!live(t)) return;
        o = o || {};
        var os = ctx.createOscillator(), g = ctx.createGain();
        os.type = 'sine';
        os.frequency.setValueAtTime(o.hi || 115, t);
        os.frequency.exponentialRampToValueAtTime(o.lo || 42, t + (o.bend || 0.14));
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.001, t + (o.dur || 0.32));
        os.connect(g); g.connect(comp);
        os.start(t); os.stop(t + (o.dur || 0.32) + 0.03);
        if (o.click) {
            var c = ctx.createBufferSource(), cg = ctx.createGain(), cf = ctx.createBiquadFilter();
            cf.type = 'highpass'; cf.frequency.value = 2500;
            cg.gain.setValueAtTime(vol * 0.35, t);
            cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            c.buffer = hatBuf; c.connect(cf); cf.connect(cg); cg.connect(comp); c.start(t);
        }
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

    // Three noise bursts 11ms apart, then a tail: the classic drum-machine clap.
    function clap(off, vol) {
        var t = at(off); if (!live(t)) return;
        var f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.1;
        f.connect(g); g.connect(comp);
        g.gain.setValueAtTime(0.0001, t);
        for (var i = 0; i < 3; i++) {
            g.gain.setValueAtTime(vol, t + i * 0.011);
            g.gain.exponentialRampToValueAtTime(vol * 0.35, t + i * 0.011 + 0.009);
        }
        g.gain.setValueAtTime(vol, t + 0.033);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        var s = ctx.createBufferSource();
        s.buffer = snareBuf; s.connect(f); s.start(t);
    }

    function hat(off, vol, open) {
        var t = at(off); if (!live(t)) return;
        var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'highpass'; f.frequency.value = open ? 6000 : 7500;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.28 : 0.06));
        s.buffer = hatBuf; s.connect(f); f.connect(g); g.connect(comp); s.start(t);
    }

    function shaker(off, vol) {
        var t = at(off); if (!live(t)) return;
        var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'highpass'; f.frequency.value = 9000;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        s.buffer = hatBuf; s.connect(f); f.connect(g); g.connect(comp); s.start(t);
    }

    // Wood rim / clave: a very short high sine with a hard edge.
    function rim(off, vol, pitch, dur) {
        var t = at(off); if (!live(t)) return;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(pitch || 1800, t);
        o.frequency.exponentialRampToValueAtTime((pitch || 1800) / 2, t + 0.02);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.045));
        o.connect(g); g.connect(comp); o.start(t); o.stop(t + (dur || 0.045) + 0.02);
    }

    // Clean electric guitar pluck: two saws a few cents apart, a filter
    // that snaps shut after the pick, and a fast decay. Sebene lives here.
    function pluck(freq, off, durBeats, vol, bright) {
        var t = at(off); if (!live(t)) return;
        var dur = durBeats * BEAT;
        var f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.Q.value = 1.2;
        f.frequency.setValueAtTime(bright || 4200, t);
        f.frequency.exponentialRampToValueAtTime(900, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        f.connect(g); g.connect(comp);
        [0, 6].forEach(function (cents) {
            var o = ctx.createOscillator();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t); o.detune.value = cents;
            var og = ctx.createGain(); og.gain.value = 0.5;
            o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 0.05);
        });
    }

    // Crowd "oh": a rough saw pushed through two vowel formants, several
    // voices slightly out of tune so it reads as people, not a synth.
    function voice(freq, off, durBeats, vol) {
        var t = at(off); if (!live(t)) return;
        var dur = durBeats * BEAT;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.04);
        g.gain.setValueAtTime(vol, t + Math.max(0.05, dur - 0.08));
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        g.connect(comp);
        [[570, 8], [840, 10], [2400, 12]].forEach(function (fm, i) {
            var f = ctx.createBiquadFilter();
            f.type = 'bandpass'; f.frequency.value = fm[0]; f.Q.value = fm[1];
            var fg = ctx.createGain(); fg.gain.value = i === 2 ? 0.25 : 1;
            f.connect(fg); fg.connect(g);
            [-12, 0, 9, 18].forEach(function (cents) {
                var o = ctx.createOscillator();
                o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t); o.detune.value = cents;
                o.frequency.linearRampToValueAtTime(freq * 0.97, t + dur);
                var og = ctx.createGain(); og.gain.value = 0.25;
                o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 0.05);
            });
        });
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

    // Sawtooth bass with a filter that opens on the attack and closes: house.
    function sawBass(freq, off, durBeats, vol, open, close) {
        var t = at(off); if (!live(t)) return;
        var o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t);
        o2.type = 'square'; o2.frequency.setValueAtTime(freq / 2, t);
        f.type = 'lowpass'; f.Q.value = 6;
        f.frequency.setValueAtTime(open, t);
        f.frequency.exponentialRampToValueAtTime(close, t + durBeats * BEAT * 0.8);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.006);
        g.gain.setValueAtTime(vol, t + durBeats * BEAT * 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, t + durBeats * BEAT);
        var g2 = ctx.createGain(); g2.gain.value = 0.35;
        o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(comp);
        o.start(t); o2.start(t); o.stop(t + durBeats * BEAT + 0.05); o2.stop(t + durBeats * BEAT + 0.05);
    }

    // Amapiano log drum: a sine that bends down into the note with a soft
    // second harmonic, a rounded attack, and a long, bouncy decay.
    function logDrum(freq, off, durBeats, vol) {
        var t = at(off); if (!live(t)) return;
        var o = ctx.createOscillator(), h = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), hg = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq * 1.7, t);
        o.frequency.exponentialRampToValueAtTime(freq, t + 0.045);
        h.type = 'triangle'; h.frequency.setValueAtTime(freq * 2, t);
        hg.gain.value = 0.18;
        f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 1.5;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, t + durBeats * BEAT);
        o.connect(f); h.connect(hg); hg.connect(f); f.connect(g); g.connect(comp);
        o.start(t); h.start(t); o.stop(t + durBeats * BEAT + 0.05); h.stop(t + durBeats * BEAT + 0.05);
    }

    // Brass section: two detuned saws per note through a filter that blooms
    // open on the attack, the "bwah" of a fanfare.
    function brass(freqs, off, durBeats, vol, bright) {
        var t = at(off); if (!live(t)) return;
        var dur = durBeats * BEAT;
        var f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.Q.value = 2;
        f.frequency.setValueAtTime(500, t);
        f.frequency.exponentialRampToValueAtTime(bright || 3200, t + 0.06);
        f.frequency.exponentialRampToValueAtTime(1400, t + dur);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.025);
        g.gain.setValueAtTime(vol, t + Math.max(0.03, dur - 0.06));
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        f.connect(g); g.connect(comp);
        freqs.forEach(function (fr) {
            [-7, 7].forEach(function (cents) {
                var o = ctx.createOscillator();
                o.type = 'sawtooth'; o.frequency.setValueAtTime(fr, t); o.detune.value = cents;
                var og = ctx.createGain(); og.gain.value = 0.5 / freqs.length;
                o.connect(og); og.connect(f);
                o.start(t); o.stop(t + dur + 0.05);
            });
        });
    }

    // Flute: a sine with a whisper of second harmonic, slow vibrato, a soft
    // attack, and a puff of breath noise at the onset.
    function flute(freq, off, durBeats, vol) {
        var t = at(off); if (!live(t)) return;
        var dur = durBeats * BEAT;
        var o = ctx.createOscillator(), h = ctx.createOscillator(), g = ctx.createGain(), hg = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
        h.type = 'sine'; h.frequency.setValueAtTime(freq * 2, t); hg.gain.value = 0.12;
        var lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.type = 'sine'; lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(freq * 0.008, t + Math.min(0.25, dur));
        lfo.connect(lg); lg.connect(o.frequency); lg.connect(h.frequency);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.045);
        g.gain.setValueAtTime(vol, t + Math.max(0.05, dur - 0.05));
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g); h.connect(hg); hg.connect(g); g.connect(comp);
        o.start(t); h.start(t); lfo.start(t);
        o.stop(t + dur + 0.05); h.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
        var n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
        nf.type = 'bandpass'; nf.frequency.value = freq * 2; nf.Q.value = 3;
        ng.gain.setValueAtTime(vol * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        n.buffer = hatBuf; n.connect(nf); nf.connect(ng); ng.connect(comp); n.start(t);
    }

    // Marimba / balafon: a sine with a touch of the fourth harmonic and a
    // short wooden decay. `hard` shortens it into a kalimba tine.
    function marimba(freq, off, durBeats, vol, hard) {
        var t = at(off); if (!live(t)) return;
        var dur = Math.min(durBeats * BEAT, hard ? 0.35 : 0.9);
        var o = ctx.createOscillator(), h = ctx.createOscillator(), g = ctx.createGain(), hg = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
        h.type = 'sine'; h.frequency.setValueAtTime(freq * (hard ? 6.2 : 4), t);
        hg.gain.setValueAtTime(hard ? 0.35 : 0.22, t);
        hg.gain.exponentialRampToValueAtTime(0.001, t + (hard ? 0.05 : 0.12));
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); h.connect(hg); hg.connect(g); g.connect(comp);
        o.start(t); h.start(t); o.stop(t + dur + 0.05); h.stop(t + dur + 0.05);
    }

    // Drawbar organ: sines stacked at octave and fifth ratios, no decay.
    function organ(freqs, off, durBeats, vol) {
        var t = at(off); if (!live(t)) return;
        var dur = durBeats * BEAT;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.02);
        g.gain.setValueAtTime(vol, t + Math.max(0.03, dur - 0.04));
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        g.connect(comp);
        freqs.forEach(function (fr) {
            [[1, 0.5], [2, 0.3], [3, 0.15], [4, 0.1]].forEach(function (d) {
                var o = ctx.createOscillator(), og = ctx.createGain();
                o.type = 'sine'; o.frequency.setValueAtTime(fr * d[0], t);
                og.gain.value = d[1] / freqs.length;
                o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05);
            });
        });
    }

    // Conga: a pitched sine hit with a quick drop. `slap` adds a noise crack.
    function conga(off, vol, pitch, slap) {
        var t = at(off); if (!live(t)) return;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime((pitch || 190) * 1.5, t);
        o.frequency.exponentialRampToValueAtTime(pitch || 190, t + 0.03);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.001, t + (slap ? 0.12 : 0.22));
        o.connect(g); g.connect(comp); o.start(t); o.stop(t + 0.25);
        if (slap) {
            var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
            f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 1.5;
            ng.gain.setValueAtTime(vol * 0.7, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            n.buffer = hatBuf; n.connect(f); f.connect(ng); ng.connect(comp); n.start(t);
        }
    }

    // Bell: inharmonic sines with a long ring.
    function bell(freq, off, vol) {
        var t = at(off); if (!live(t)) return;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
        g.connect(comp);
        [[1, 0.5], [2.76, 0.25], [5.4, 0.12], [8.9, 0.06]].forEach(function (d) {
            var o = ctx.createOscillator(), og = ctx.createGain();
            o.type = 'sine'; o.frequency.setValueAtTime(freq * d[0], t); og.gain.value = d[1];
            o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.7);
        });
    }

    // Djembe: kind 'bass' (deep centre hit), 'tone' (open edge), 'slap'
    // (sharp crack). Sine with a pitch drop, plus noise for the slap.
    function djembe(off, vol, kind) {
        var t = at(off); if (!live(t)) return;
        var pitch = kind === 'bass' ? 85 : kind === 'slap' ? 330 : 240;
        var dur = kind === 'bass' ? 0.32 : kind === 'slap' ? 0.09 : 0.18;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(pitch * 1.8, t);
        o.frequency.exponentialRampToValueAtTime(pitch, t + 0.025);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(comp); o.start(t); o.stop(t + dur + 0.03);
        if (kind !== 'bass') {
            var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
            f.type = 'bandpass'; f.frequency.value = kind === 'slap' ? 3400 : 1800; f.Q.value = 1.2;
            ng.gain.setValueAtTime(vol * (kind === 'slap' ? 0.9 : 0.35), t);
            ng.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'slap' ? 0.05 : 0.03));
            n.buffer = hatBuf; n.connect(f); f.connect(ng); ng.connect(comp); n.start(t);
        }
    }

    // Dundun: the big bass drum of the ensemble. Deeper and longer than a
    // kick, with a wooden stick click on top.
    function dundun(off, vol, low) {
        var t = at(off); if (!live(t)) return;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(low ? 110 : 150, t);
        o.frequency.exponentialRampToValueAtTime(low ? 44 : 62, t + 0.09);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, t + (low ? 0.6 : 0.45));
        o.connect(g); g.connect(comp); o.start(t); o.stop(t + 0.65);
        var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
        f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 1;
        ng.gain.setValueAtTime(vol * 0.4, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        n.buffer = hatBuf; n.connect(f); f.connect(ng); ng.connect(comp); n.start(t);
    }

    // Talking drum: a tone whose pitch slides while it rings.
    function talk(off, vol, from, to, durBeats) {
        var t = at(off); if (!live(t)) return;
        var dur = durBeats * BEAT;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(from, t);
        o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(comp); o.start(t); o.stop(t + dur + 0.03);
    }

    // Airhorn: three detuned saws that fall a whole tone with a wobble.
    function airhorn(off, durBeats, vol) {
        var t = at(off); if (!live(t)) return;
        var dur = durBeats * BEAT;
        var f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.frequency.value = 2800; f.Q.value = 3;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.02);
        g.gain.setValueAtTime(vol, t + dur * 0.7);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        f.connect(g); g.connect(comp);
        var lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 9; lg.gain.value = 6; lfo.connect(lg);
        [660, 664, 990].forEach(function (fr, i) {
            var o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(fr, t);
            o.frequency.exponentialRampToValueAtTime(fr * 0.89, t + dur * 0.5);
            lg.connect(o.frequency);
            var og = ctx.createGain(); og.gain.value = i === 2 ? 0.2 : 0.4;
            o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 0.05);
        });
        lfo.start(t); lfo.stop(t + dur + 0.05);
    }

    // Impact: a sub drop with a noise burst, for the top of a section.
    function impact(off, vol) {
        var t = at(off); if (!live(t)) return;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(90, t);
        o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        o.connect(g); g.connect(comp); o.start(t); o.stop(t + 1.5);
        var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
        var len = Math.floor(ctx.sampleRate * 0.6), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        n.buffer = b; f.type = 'lowpass'; f.frequency.setValueAtTime(8000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.5);
        ng.gain.setValueAtTime(vol * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        n.connect(f); f.connect(ng); ng.connect(comp); n.start(t);
    }

    // Sustained chord that ducks on every beat, the pumping sidechain feel
    // that makes a dance floor lean into the kick.
    function pad(freqs, off, durBeats, vol, cutoff, duck) {
        var t = at(off); if (!live(t)) return;
        var f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.7;
        f.connect(g); g.connect(comp);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.05);
        if (duck) {
            for (var b = 1; b < durBeats; b++) {
                var bt = t + b * BEAT;
                g.gain.setValueAtTime(vol * 0.25, bt);
                g.gain.linearRampToValueAtTime(vol, bt + BEAT * 0.45);
            }
        }
        g.gain.setValueAtTime(vol, t + durBeats * BEAT - 0.08);
        g.gain.linearRampToValueAtTime(0.0001, t + durBeats * BEAT);
        freqs.forEach(function (fr, i) {
            var o = ctx.createOscillator();
            o.type = i % 2 ? 'triangle' : 'sawtooth';
            o.frequency.setValueAtTime(fr, t);
            o.detune.value = (i % 2 ? -1 : 1) * 6;
            var og = ctx.createGain(); og.gain.value = i % 2 ? 0.7 : 0.3;
            o.connect(og); og.connect(f);
            o.start(t); o.stop(t + durBeats * BEAT + 0.05);
        });
    }

    // Filtered noise sweep over `durBeats`: the riser before a drop.
    function riser(off, durBeats, vol) {
        var t = at(off); if (!live(t)) return;
        var len = Math.floor(ctx.sampleRate * durBeats * BEAT) + 1;
        var b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = b;
        f.type = 'bandpass'; f.Q.value = 1.2;
        f.frequency.setValueAtTime(300, t);
        f.frequency.exponentialRampToValueAtTime(6000, t + durBeats * BEAT);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + durBeats * BEAT);
        g.gain.setValueAtTime(0.0001, t + durBeats * BEAT + 0.001);
        s.connect(f); f.connect(g); g.connect(comp); s.start(t); s.stop(t + durBeats * BEAT + 0.01);
    }

    /* ── Beds: the quiet layer that runs under a whole session. ── */

    var BEDS = {
        // Vinyl crackle: sparse pops over a faint hiss, rolled off at 3.2k
        // so it reads as an old record or a distant station, not static.
        vinyl: function () {
            var len = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
            for (var i = 0; i < len; i++) d[i] = (Math.random() < 0.0015 ? (Math.random() * 2 - 1) : 0) * 0.8 + (Math.random() * 2 - 1) * 0.02;
            var src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
            var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
            var g = ctx.createGain(); g.gain.value = 0.35;
            src.connect(f); f.connect(g); g.connect(comp);
            return src;
        },
        // Room air: a whisper of band-limited hiss so the drops never land on silence.
        air: function () {
            var len = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
            for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.03;
            var src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
            var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.4;
            var g = ctx.createGain(); g.gain.value = 0.25;
            src.connect(f); f.connect(g); g.connect(comp);
            return src;
        }
    };

    /* ── Tracks ── */

    var CRACKLE_CHORDS = [
        { root: N.D1, tones: [N.D3, N.F3, N.A3, N.C4] },
        { root: N.G1, tones: [N.G3, N.B3, N.D3 * 2, N.F3 * 2] },
        { root: N.C2, tones: [N.C4, N.E4, N.G4, N.B3] },
        { root: N.A1, tones: [N.A3, N.C4, N.E4, N.G4] }
    ];
    var CRACKLE_MELODY = [
        [N.A4, N.C5, N.D5, null, N.C5, null, N.A4, null],
        [N.G4, null, N.A4, N.C5, null, N.D5, null, null],
        [N.E5, N.D5, null, N.C5, null, N.A4, null, N.G4],
        [null, N.A4, null, null, N.C5, null, N.D5, null]
    ];

    // Stride: Fm7, Dbmaj7, Abmaj7, Eb. Deep house, one chord a bar.
    var STRIDE_CHORDS = [
        { root: N.F1, tones: [N.F3, N.Ab3, N.C4, N.Eb4], stab: [N.Ab4, N.C5, N.Eb5] },
        { root: N.Db1, tones: [N.Db3, N.F3, N.Ab3, N.C4], stab: [N.F4, N.Ab4, N.C5] },
        { root: N.Ab1, tones: [N.Ab2, N.C3, N.Eb3, N.G3], stab: [N.Eb4, N.G4, N.C5] },
        { root: N.Eb1, tones: [N.Eb3, N.G3, N.Bb3, N.D4], stab: [N.G4, N.Bb4, N.D5] }
    ];
    // Offbeat house bass: rests on the kick, speaks between them.
    var STRIDE_BASS = [
        [0.5, 1.5, 2.5, 3.5],
        [0.5, 1.5, 2.5, 3.25, 3.75],
        [0.5, 1.5, 2.5, 3.5],
        [0.5, 1.25, 1.5, 2.5, 3.5]
    ];
    var STRIDE_LEAD = [
        [null, N.C5, null, N.Eb5, null, N.C5, N.Ab4, null],
        [null, N.C5, null, N.F5, null, N.Eb5, null, N.C5],
        [null, N.G4, null, N.C5, null, N.Eb5, N.C5, null],
        [null, N.Bb4, null, N.D5, null, N.Eb5, null, null]
    ];

    // Sprint: E minor. Log drum lines and Em9 / Cmaj9 / D / Bm7 pads.
    var SPRINT_CHORDS = [
        { pad: [N.E3, N.G3, N.B3, N.D4, N.G4], bass: [N.E1, N.E1, N.G1, N.E1, N.B1, N.D2] },
        { pad: [N.C3, N.E3, N.G3, N.B3, N.D4], bass: [N.C2, N.E1, N.G1, N.C2, N.B1, N.G1] },
        { pad: [N.D3, N.A3, N.D4, N.E4, N.A4], bass: [N.D2, N.A1, N.D2, N.E2, N.D2, N.A1] },
        { pad: [N.B2, N.D3, N.G3, N.A3, N.D4], bass: [N.B1, N.B1, N.D2, N.B1, N.A1, N.G1] }
    ];
    // Log drum hits: [beat offset, index into chord.bass, length in beats]
    var SPRINT_LOG = [
        [[0.5, 0, 0.5], [1.0, 1, 0.75], [1.75, 2, 0.75], [2.5, 3, 0.5], [3.0, 4, 0.5], [3.5, 5, 0.5]],
        [[0.5, 0, 0.5], [1.0, 1, 0.5], [1.5, 2, 0.5], [2.0, 3, 0.5], [2.5, 4, 1.0], [3.5, 5, 0.5]]
    ];
    var SPRINT_LEAD = [
        [N.E5, null, N.G5, null, null, N.E5, null, N.D5],
        [null, null, N.B4, null, N.D5, null, N.E5, null],
        [N.A4, null, null, N.D5, null, null, N.E5, null],
        [null, N.G5, null, N.E5, null, N.D5, null, N.B4]
    ];

    // Parade: C, G, Am, F. Brass stabs, a flute on top, a snare that marches.
    var PARADE_CHORDS = [
        { root: N.C2, brass: [N.C4, N.E4, N.G4], high: [N.G4, N.C5, N.E5] },
        { root: N.G1, brass: [N.G3, N.B3, N.D4], high: [N.G4, N.B4, N.D5] },
        { root: N.A1, brass: [N.A3, N.C4, N.E4], high: [N.A4, N.C5, N.E5] },
        { root: N.F1, brass: [N.F3, N.A3, N.C4], high: [N.A4, N.C5, N.F5] }
    ];
    // Fanfare rhythms: [offset, length in beats]
    var PARADE_STABS = [
        [[0, 0.4], [0.5, 0.4], [1, 1.4], [2.5, 0.4], [3, 0.9]],
        [[0, 0.9], [1.5, 0.4], [2, 0.4], [2.5, 1.4]]
    ];
    // Intro call, one trumpet: [offset, note, length]
    var PARADE_CALL = [
        [[0, N.C5, 0.4], [0.5, N.C5, 0.4], [1, N.C5, 0.4], [1.5, N.G5, 2.4]],
        [[0, N.E5, 0.4], [0.5, N.G5, 0.4], [1, N.C6, 2.9]],
        [[0, N.C5, 0.4], [0.5, N.C5, 0.4], [1, N.C5, 0.4], [1.5, N.A5, 1.4], [3, N.G5, 0.9]],
        [[0, N.E5, 0.4], [0.5, N.G5, 0.4], [1, N.A5, 0.4], [1.5, N.B5, 0.4], [2, N.C6, 1.9]]
    ];
    // Flute lines in eighths, two bars each, C major
    var PARADE_FLUTE = [
        [N.G5, null, N.A5, N.G5, N.E5, null, N.D5, N.E5],
        [N.G5, null, null, N.E5, N.G5, N.A5, null, null],
        [N.C6, null, N.B5, N.A5, N.G5, null, N.E5, N.G5],
        [N.A5, N.G5, null, N.E5, null, N.D5, N.C5, null],
        [N.E5, N.G5, N.A5, null, N.C6, null, N.B5, N.A5],
        [N.G5, null, N.E5, null, N.G5, N.A5, N.G5, null],
        [N.C6, null, N.D6, N.C6, N.B5, null, N.G5, null],
        [N.A5, null, N.G5, null, N.C6, null, null, null]
    ];

    // Rumba: G, C, D, C. Congolese sebene, two guitars locked in sixteenths.
    var RUMBA_CHORDS = [
        { root: N.G1, fifth: N.D2, arp: [N.G4, N.B4, N.D5, N.G5], lead: [N.G5, N.B5, N.D6, N.G5] },
        { root: N.C2, fifth: N.G1, arp: [N.G4, N.C5, N.E5, N.G5], lead: [N.E5, N.G5, N.C6, N.E5] },
        { root: N.D2, fifth: N.A1, arp: [N.A4, N.D5, N.Gb5, N.A5], lead: [N.Gb5, N.A5, N.D6, N.Gb5] },
        { root: N.C2, fifth: N.G1, arp: [N.G4, N.C5, N.E5, N.G5], lead: [N.E5, N.G5, N.C6, N.E5] }
    ];
    // Mi-solo: index into arp for each sixteenth, -1 rests
    var RUMBA_ARP = [
        [0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 1, 3, 2, 3, 2],
        [0, 2, 1, 2, 3, 2, 1, -1, 0, 2, 1, 2, 3, 1, 2, 3]
    ];
    // Lead guitar riff, two bars, index into lead (-1 rests)
    var RUMBA_LEAD = [
        [0, -1, 1, 0, -1, 2, -1, 1, 0, -1, 1, -1, 3, 1, 0, -1],
        [2, -1, 1, 2, -1, 0, -1, -1, 1, 2, -1, 1, 0, -1, -1, -1]
    ];
    var RUMBA_BASS = [[0, 0], [0.75, 1], [1.5, 0], [2, 0], [2.75, 1], [3.5, 0]];

    // Bounce: Am, F, C, G. Afrobeats at 104, the log drum carries the hook.
    var BOUNCE_CHORDS = [
        { pad: [N.A3, N.C4, N.E4, N.G4], keys: [N.E4, N.A4, N.C5], hook: [N.A1, N.C2, N.E2, N.A1, N.G1] },
        { pad: [N.F3, N.A3, N.C4, N.E4], keys: [N.F4, N.A4, N.C5], hook: [N.F1, N.A1, N.C2, N.F1, N.E1] },
        { pad: [N.C3, N.E3, N.G3, N.C4], keys: [N.E4, N.G4, N.C5], hook: [N.C2, N.E2, N.G2, N.C2, N.B1] },
        { pad: [N.G3, N.B3, N.D4, N.G4], keys: [N.D4, N.G4, N.B4], hook: [N.G1, N.B1, N.D2, N.G1, N.E1] }
    ];
    // Log drum hook: [offset, hook index, length]
    var BOUNCE_HOOK = [[0.5, 0, 0.5], [1, 1, 0.75], [1.75, 2, 0.75], [2.5, 3, 0.5], [3.25, 4, 0.75]];
    // Whistle hook, two bars, eighths
    var BOUNCE_WHISTLE = [
        [N.E5, null, N.E5, N.G5, null, N.E5, N.D5, null],
        [N.C5, null, N.D5, null, N.E5, null, null, null],
        [N.E5, null, N.E5, N.G5, null, N.A5, N.G5, null],
        [N.E5, null, N.D5, null, N.C5, null, null, null]
    ];

    // Anthem: rap beat whose hook is a chant. "Bong" is a low brass hit
    // on the root, "bing" a whistle high above it. Groups of three per
    // bar, cycling bong-bong-bong, bong-bing-bong, bong-bing-bong,
    // bong-bong-bong. Dm, Dm, Bb, C.
    var ANTHEM_CHORDS = [
        { root: N.D2, low: [N.D3, N.A3, N.D4], high: [N.D5, N.F5, N.A5], bing: N.A5 },
        { root: N.D2, low: [N.D3, N.A3, N.D4], high: [N.D5, N.F5, N.A5], bing: N.A5 },
        { root: N.Bb3 / 4, low: [N.Bb3 / 2, N.F3, N.Bb3], high: [N.D5, N.F5, N.Bb4 * 2], bing: N.F5 },
        { root: N.C2, low: [N.C3, N.G3, N.C4], high: [N.C5, N.E5, N.G5], bing: N.G5 }
    ];
    var ANTHEM_CHANT = [[0, 0, 0], [0, 1, 0], [0, 1, 0], [0, 0, 0]]; // 0 bong, 1 bing
    var ANTHEM_HITS = [0, 1, 2]; // beats of the three calls, beat 4 answers with whistle
    var ANTHEM_ANSWER = [
        [[3, N.D6, 0.25], [3.25, N.F5 * 2, 0.25], [3.5, N.A5, 0.5]],
        [[3, N.A5, 0.5], [3.5, N.D6, 0.5]],
        [[3, N.F5 * 2, 0.25], [3.25, N.D6, 0.25], [3.5, N.Bb4 * 2, 0.5]],
        [[3, N.G5, 0.25], [3.25, N.A5, 0.25], [3.5, N.C6, 0.5]]
    ];

    // Anthem II: the chant again, over a West African drum ensemble.
    var ANTHEM2_DJEMBE = [
        // [offset, kind] one bar, sixteenths. Tone/slap conversation with a bass on the one.
        [[0, 'bass'], [0.5, 'tone'], [0.75, 'tone'], [1.25, 'slap'], [1.5, 'tone'], [2, 'bass'], [2.5, 'slap'], [2.75, 'tone'], [3.25, 'slap'], [3.5, 'tone'], [3.75, 'slap']],
        [[0, 'bass'], [0.25, 'tone'], [0.5, 'tone'], [1, 'slap'], [1.5, 'tone'], [1.75, 'tone'], [2, 'bass'], [2.5, 'slap'], [3, 'slap'], [3.25, 'tone'], [3.5, 'slap'], [3.75, 'tone']]
    ];

    // Rally: a chant dictated word for word. One syllable per eighth note,
    // a rest at every full stop. Pong is low, ping is high. The phrases
    // are uneven on purpose (7, 7, 7, 17, 7, 7, 15, 15, 7, 16, 15), which
    // is what makes it feel chanted rather than programmed.
    var RALLY_TEXT = 'Pong pong ping pong pong pong pong. Pong pong ping pong pong pong pong. Pong pong ping pong pong pong pong. ' +
        'Pong pong ping pong pong pong pong ping pong pong pong pong ping pong pong pong pong. Pong pong ping pong pong pong pong. ' +
        'Pong pong ping pong pong pong pong. Pong pong ping pong pong pong ping pong pong pong ping pong pong pong pong. ' +
        'Pong ping pong ping pong ping pong ping pong pong ping pong pong pong pong. Pong pong ping pong pong pong pong. ' +
        'Pong pong ping pong pong pong pong ping pong pong pong ping pong pong pong pong. ' +
        'Pong ping pong pong ping pong pong pong pong pong ping pong pong pong pong.';
    var RALLY_SEQ = [];
    RALLY_TEXT.toLowerCase().split(/\s+/).forEach(function (w) {
        var stop = w.slice(-1) === '.';
        RALLY_SEQ.push(w.indexOf('ping') === 0 ? 1 : 0);
        if (stop) RALLY_SEQ.push(-1);
    });
    var RALLY_BARS = Math.ceil(RALLY_SEQ.length / 8);
    // Gm, Gm, Eb, F, one chord every four bars
    var RALLY_CHORDS = [
        { root: N.G1, low: [N.G3, N.D4, N.G4], high: [N.G5, N.Bb5, N.D6], ping: N.D6 },
        { root: N.G1, low: [N.G3, N.D4, N.G4], high: [N.G5, N.Bb5, N.D6], ping: N.D6 },
        { root: N.Eb1, low: [N.Eb3, N.Bb3, N.Eb4], high: [N.G5, N.Bb5, N.Eb5 * 2], ping: N.Bb5 },
        { root: N.F1, low: [N.F3, N.C4, N.F4], high: [N.A5, N.C6, N.F5 * 2], ping: N.C6 }
    ];

    var TRACKS = [
        {
            id: 'crackle', name: 'Crackle', bpm: 84, bars: 32, swing: 0.08, bed: 'vinyl',
            style: 'Lo-fi boom-bap',
            blurb: 'The original. Dusty keys over a swung boom-bap kit, a sub on every root, and a vinyl crackle bed the whole way through.',
            bar: function (bar) {
                var ch = CRACKLE_CHORDS[bar % 4];
                var fade = bar >= 30 ? (BARS - bar) / 2 : 1;
                var drums = bar >= 4;
                var din = bar >= 4 && bar < 6 ? (bar - 4 + 1) / 2 : 1;
                ch.tones.forEach(function (f) {
                    tone(f, 0, 2.6, 0.075 * fade, 'triangle', 1100, 0.04);
                    tone(f, 2.5 + SWING, 1.1, 0.045 * fade, 'triangle', 900, 0.03);
                });
                if (drums) {
                    kick(0, 0.55 * din * fade);
                    kick(1.5 + SWING, 0.42 * din * fade);
                    if (bar % 4 === 3) kick(3.5 + SWING, 0.35 * din * fade);
                    snare(1, 0.42 * din * fade);
                    snare(3, 0.42 * din * fade);
                    if (bar % 8 === 7) snare(3.75, 0.18 * din * fade);
                    for (var e = 0; e < 8; e++) {
                        var off = e * 0.5 + (e % 2 === 1 ? SWING : 0);
                        hat(off, (e % 2 === 0 ? 0.11 : 0.065) * din * fade, false);
                    }
                    if (bar % 2 === 1) hat(3.5 + SWING, 0.09 * din * fade, true);
                    tone(ch.root, 0, 1.4, 0.5 * din * fade, 'sine', 180, 0.01);
                    tone(ch.root, 2.5 + SWING, 1.1, 0.4 * din * fade, 'sine', 180, 0.01);
                    if (bar % 2 === 1) tone(ch.root * 1.5, 3.5 + SWING, 0.5, 0.3 * din * fade, 'sine', 200, 0.01);
                }
                if (bar >= 12 && bar < 28) {
                    var line = CRACKLE_MELODY[Math.floor(bar / 2) % CRACKLE_MELODY.length];
                    for (var s = 0; s < 8; s++) {
                        if (!line[s]) continue;
                        tone(line[s], s * 0.5 + (s % 2 === 1 ? SWING : 0), 0.7, 0.07 * fade, 'triangle', 2600, 0.004);
                    }
                }
            }
        },
        {
            id: 'stride', name: 'Stride', bpm: 126, bars: 32, swing: 0.02, bed: 'air',
            style: 'Deep house',
            blurb: 'Four on the floor. A kick every beat, claps on two and four, open hats in the gaps, a filtered bass that only speaks between the kicks, and chords that pump against the drums.',
            bar: function (bar) {
                var ch = STRIDE_CHORDS[bar % 4];
                var phase = bar < 4 ? 'intro' : bar < 28 ? 'full' : 'break';
                var full = phase === 'full', brk = phase === 'break';
                var last = bar === 31, e;
                var K = { hi: 160, lo: 46, bend: 0.07, dur: 0.42, click: true };

                if (!brk) {
                    for (e = 0; e < 4; e++) kick(e, 0.72, K);
                    if (bar >= 2) { clap(1, 0.32); clap(3, 0.32); }
                    for (e = 0; e < 8; e++) {
                        var off = e * 0.5 + (e % 2 ? SWING : 0);
                        if (e % 2) hat(off, 0.16, true); else hat(off, 0.05, false);
                    }
                    for (e = 0; e < 16; e++) if (e % 4 !== 0) shaker(e * 0.25 + (e % 2 ? SWING : 0), 0.045);
                    if (bar % 8 === 7) { clap(3.5, 0.22); clap(3.75, 0.28); }
                } else {
                    for (e = 0; e < 8; e++) if (e % 2) hat(e * 0.5 + SWING, 0.12, true);
                    if (bar === 30 || last) for (e = 0; e < 16; e++) shaker(e * 0.25, 0.04 + e * 0.004);
                    if (last) { clap(2, 0.22); clap(2.5, 0.24); clap(3, 0.26); clap(3.5, 0.3); }
                }

                if (full || brk) {
                    pad(ch.tones, 0, 4, brk ? 0.11 : 0.085, brk ? 2600 : 1500, !brk);
                }
                if (bar >= 2 && !brk) {
                    STRIDE_BASS[bar % 4].forEach(function (b) {
                        sawBass(ch.root * 2, b + SWING, 0.45, 0.42, 900, 180);
                    });
                    sawBass(ch.root, 0, 0.3, 0.28, 400, 120);
                }
                if (full) {
                    // Chord stab on the and of 2 and the and of 4
                    ch.stab.forEach(function (f) {
                        tone(f, 1.5 + SWING, 0.35, 0.06, 'sawtooth', 2400, 0.003);
                        tone(f, 3.5 + SWING, 0.35, 0.05, 'sawtooth', 2200, 0.003);
                    });
                }
                if (bar >= 12 && bar < 28) {
                    var line = STRIDE_LEAD[bar % 4];
                    for (var s = 0; s < 8; s++) {
                        if (!line[s]) continue;
                        tone(line[s], s * 0.5 + (s % 2 ? SWING : 0), 0.6, 0.055, 'square', 1800, 0.004);
                    }
                }
                if (bar === 28) riser(0, 16, 0.16);
            }
        },
        {
            id: 'sprint', name: 'Sprint', bpm: 148, bars: 32, swing: 0.03, bed: 'air',
            style: 'Log drum, afro-tech',
            blurb: 'The fast one. A broken kick, shakers on every sixteenth, a clave you can clap to, and the bass is a log drum: a sine that bends into each note and bounces. Built to move hips, not heads.',
            bar: function (bar) {
                var ch = SPRINT_CHORDS[bar % 4];
                var phase = bar < 4 ? 'intro' : bar < 28 ? 'full' : 'break';
                var full = phase === 'full', brk = phase === 'break';
                var last = bar === 31, e;
                var K = { hi: 140, lo: 48, bend: 0.06, dur: 0.3, click: true };

                if (!brk) {
                    kick(0, 0.7, K); kick(1.75, 0.5, K); kick(2.5, 0.66, K);
                    if (bar % 4 === 3) kick(3.75, 0.45, K);
                    for (e = 0; e < 16; e++) shaker(e * 0.25 + (e % 2 ? SWING : 0), e % 4 === 2 ? 0.075 : 0.04);
                    [0, 0.75, 1.5, 2, 2.5, 3.25].forEach(function (o) { rim(o, 0.09); });
                    if (bar >= 2) { clap(1, 0.26); clap(3, 0.3); }
                    for (e = 0; e < 4; e++) hat(e + 0.5 + SWING, 0.13, true);
                    if (bar % 8 === 7) { snare(3.5, 0.2); snare(3.75, 0.24); }
                } else {
                    for (e = 0; e < 16; e++) shaker(e * 0.25, 0.03 + (bar - 28) * 0.012 + e * 0.002);
                    [0, 0.75, 1.5, 2, 2.5, 3.25].forEach(function (o) { rim(o, 0.07); });
                    if (last) { clap(2, 0.2); clap(2.5, 0.22); clap(3, 0.26); clap(3.5, 0.3); }
                }

                if (bar >= 2 || brk) pad(ch.pad, 0, 4, brk ? 0.1 : 0.07, brk ? 2200 : 1300, !brk);

                if (bar >= 4 && !brk) {
                    SPRINT_LOG[bar % 2].forEach(function (h) {
                        logDrum(ch.bass[h[1]], h[0] + (h[0] % 1 ? SWING : 0), h[2] + 0.15, 0.62);
                    });
                    logDrum(ch.bass[0], 0, 0.5, 0.45);
                }
                if (bar >= 12 && bar < 28) {
                    var line = SPRINT_LEAD[bar % 4];
                    for (var s = 0; s < 8; s++) {
                        if (!line[s]) continue;
                        tone(line[s], s * 0.5 + (s % 2 ? SWING : 0), 0.55, 0.05, 'triangle', 3000, 0.004);
                    }
                }
                if (bar === 28) riser(0, 16, 0.14);
            }
        },
        {
            id: 'parade', name: 'Parade', bpm: 132, bars: 32, swing: 0.02, bed: 'air',
            style: 'Brass fanfare and flute',
            blurb: 'The upbeat one. A trumpet call opens it, then a marching snare, a tambourine, brass stabs on every chord, and a flute that runs up and down the top the whole way. Major key, hands in the air.',
            bar: function (bar) {
                var ch = PARADE_CHORDS[bar % 4];
                var phase = bar < 4 ? 'intro' : bar < 28 ? 'full' : 'break';
                var full = phase === 'full', brk = phase === 'break';
                var last = bar === 31, e;
                var K = { hi: 150, lo: 50, bend: 0.06, dur: 0.3, click: true };

                if (phase === 'intro') {
                    // One trumpet, a snare roll under the last bar
                    PARADE_CALL[bar].forEach(function (n) { brass([n[1]], n[0], n[2], 0.16, 3600); });
                    if (bar >= 2) for (e = 0; e < 8; e++) shaker(e * 0.5, 0.05);
                    if (bar === 3) for (e = 0; e < 16; e++) snare(e * 0.25, 0.08 + e * 0.02);
                    sawBass(ch.root, 0, 0.6, 0.22, 500, 160);
                    if (bar >= 2) sawBass(ch.root, 2, 0.6, 0.22, 500, 160);
                    return;
                }
                if (!brk) {
                    for (e = 0; e < 4; e++) kick(e, 0.68, K);
                    if (bar % 2 === 1) kick(2.5, 0.45, K);
                    snare(1, 0.4); snare(3, 0.4);
                    if (bar % 2 === 1) snare(3.75, 0.16);
                    if (bar % 8 === 7) { snare(3.25, 0.2); snare(3.5, 0.26); snare(3.75, 0.32); }
                    for (e = 0; e < 8; e++) shaker(e * 0.5 + (e % 2 ? SWING : 0), e % 2 ? 0.07 : 0.045);
                    for (e = 0; e < 16; e++) if (e % 2) hat(e * 0.25, 0.035, false);
                    hat(1.5, 0.11, true); hat(3.5, 0.11, true);
                } else {
                    for (e = 0; e < 8; e++) shaker(e * 0.5, 0.05 + (bar - 28) * 0.01);
                    if (bar >= 30) for (e = 0; e < 16; e++) snare(e * 0.25, 0.05 + (bar - 30) * 0.08 + e * 0.01);
                    if (last) { kick(0, 0.6, K); kick(2, 0.6, K); }
                }

                // Bass: root on the beat, octave on the pickups
                if (!brk) {
                    sawBass(ch.root, 0, 0.7, 0.36, 700, 170);
                    sawBass(ch.root * 2, 1.5 + SWING, 0.4, 0.28, 900, 200);
                    sawBass(ch.root, 2, 0.7, 0.34, 700, 170);
                    sawBass(ch.root * 2, 3.5 + SWING, 0.4, 0.28, 900, 200);
                } else {
                    sawBass(ch.root, 0, 3.8, 0.22, 500, 300);
                }

                // Fanfare
                if (full) {
                    PARADE_STABS[bar % 2].forEach(function (st) {
                        brass(ch.brass, st[0], st[1], 0.13, 3000);
                        if (bar % 8 >= 4) brass(ch.high, st[0], st[1], 0.05, 4200);
                    });
                } else if (bar === 28 || bar === 29) {
                    brass(ch.brass, 0, 3.6, 0.1, 1800);
                } else {
                    brass(ch.high, 0, 3.9, 0.11, 2600 + (bar - 30) * 1200);
                }

                // Flute
                if (bar >= 6) {
                    var line = PARADE_FLUTE[bar % PARADE_FLUTE.length];
                    for (var s = 0; s < 8; s++) {
                        if (!line[s]) continue;
                        var len = 0.55; while (s + 1 < 8 && !line[s + 1] && len < 2) len += 0.5;
                        flute(line[s], s * 0.5 + (s % 2 ? SWING : 0), len, brk ? 0.13 : 0.1);
                    }
                }
                if (bar === 29) riser(0, 12, 0.15);
            }
        },
        {
            id: 'rumba', name: 'Rumba', bpm: 138, bars: 16, swing: 0, bed: 'air',
            style: 'Congolese sebene',
            blurb: 'For the dance video. No intro, the sebene starts on the first beat: two clean guitars locked in sixteenths, a lead riff on top, a cowbell, and a bass that skips. Kinshasa at full speed, made to loop under fifteen seconds of footwork.',
            bar: function (bar) {
                var ch = RUMBA_CHORDS[bar % 4];
                var e, last = bar === 15, drop = bar >= 8 && bar < 10;
                var K = { hi: 130, lo: 48, bend: 0.05, dur: 0.24, click: true };

                // Drums: sebene kit, drop the kick for two bars so it hits again
                if (!drop) {
                    kick(0, 0.76, K); kick(1.5, 0.52, K); kick(2, 0.72, K); kick(3.5, 0.52, K);
                }
                snare(1, 0.48); snare(3, 0.5);
                if (bar % 4 === 3) { snare(3.5, 0.2); snare(3.75, 0.28); }
                for (e = 0; e < 16; e++) if (e % 2) rim(e * 0.25, 0.05);
                for (e = 0; e < 8; e++) hat(e * 0.5, e % 2 ? 0.07 : 0.045, false);
                [0, 0.75, 1.5, 2.5, 3.25].forEach(function (o) { rim(o, 0.12, 820, 0.09); });
                if (last) { for (e = 0; e < 8; e++) snare(2 + e * 0.25, 0.12 + e * 0.03); }

                // Bass
                if (!drop) RUMBA_BASS.forEach(function (b) {
                    tone(b[1] ? ch.fifth : ch.root, b[0], 0.55, 0.62, 'sine', 260, 0.006);
                });

                // Guitar 1, mi-solo, sixteenths all bar
                var arp = RUMBA_ARP[bar % 2];
                for (e = 0; e < 16; e++) {
                    if (arp[e] < 0) continue;
                    pluck(ch.arp[arp[e]], e * 0.25, 0.32, e % 4 === 0 ? 0.17 : 0.13, 4200);
                }
                // Guitar 2, the riff, an octave up in pitch and mixed a touch lower
                var lead = RUMBA_LEAD[bar % 2];
                for (e = 0; e < 16; e++) {
                    if (lead[e] < 0) continue;
                    pluck(ch.lead[lead[e]], e * 0.25, 0.45, 0.12, 5200);
                }
                // Shout on the turnaround
                if (bar % 4 === 3) { voice(N.G4, 2, 0.5, 0.14); voice(N.G4, 2.5, 0.9, 0.16); }
            }
        },
        {
            id: 'bounce', name: 'Bounce', bpm: 104, bars: 16, swing: 0.04, bed: 'air',
            style: 'Afrobeats',
            blurb: 'For the dance video. Starts on the hook: a log drum bass line you can hum, shakers on every sixteenth, a lazy clap, a whistle on top, and a crowd "oh" every second bar. Mid-tempo swing, hips first.',
            bar: function (bar) {
                var ch = BOUNCE_CHORDS[bar % 4];
                var e, last = bar === 15, lift = bar >= 12;
                var K = { hi: 140, lo: 46, bend: 0.06, dur: 0.34, click: true };

                kick(0, 0.7, K); kick(1.75, 0.5, K); kick(2.5, 0.66, K);
                if (bar % 2 === 1) kick(3.75, 0.4, K);
                clap(1 + 0.03, 0.3); clap(3 + 0.03, 0.34);
                for (e = 0; e < 16; e++) shaker(e * 0.25 + (e % 2 ? SWING : 0), e % 4 === 2 ? 0.08 : 0.04);
                [0.5, 1.5, 2.25, 3, 3.5].forEach(function (o) { rim(o + SWING, 0.07); });
                hat(0.5 + SWING, 0.1, true); hat(2.5 + SWING, 0.1, true);
                if (bar % 4 === 3) { snare(3.5, 0.18); snare(3.75, 0.24); }
                if (last) { for (e = 0; e < 4; e++) clap(2 + e * 0.5, 0.2 + e * 0.05); }

                // Pad, ducked on the kicks
                pad(ch.pad, 0, 4, lift ? 0.075 : 0.06, 1400, true);
                // Keys on the offbeats
                ch.keys.forEach(function (f) {
                    tone(f, 1.5 + SWING, 0.4, 0.05, 'triangle', 2600, 0.004);
                    tone(f, 3.5 + SWING, 0.4, 0.045, 'triangle', 2400, 0.004);
                });
                // The hook, log drum
                logDrum(ch.hook[0], 0, 0.5, 0.5);
                BOUNCE_HOOK.forEach(function (h) {
                    logDrum(ch.hook[h[1]], h[0] + (h[0] % 1 ? SWING : 0), h[2] + 0.15, 0.62);
                });
                // Whistle
                var line = BOUNCE_WHISTLE[bar % 4];
                for (e = 0; e < 8; e++) {
                    if (!line[e]) continue;
                    var len = 0.5; while (e + 1 < 8 && !line[e + 1] && len < 1.5) len += 0.5;
                    flute(line[e] * 2, e * 0.5 + (e % 2 ? SWING : 0), len, lift ? 0.075 : 0.06);
                }
                // Crowd
                if (bar % 2 === 1) { voice(N.A3, 3, 0.45, 0.13); voice(N.A3, 3.5, 0.5, 0.15); }
                if (bar % 8 === 7) { voice(N.C4, 2, 0.45, 0.12); voice(N.E4, 2.5, 0.9, 0.14); }
            }
        },
        {
            id: 'anthem', name: 'Anthem', bpm: 92, bars: 16, swing: 0.05, bed: 'vinyl',
            style: 'Rap, whistle and fanfare',
            blurb: 'A rap beat whose hook is a chant. Bong is a low brass hit with an 808 under it, bing is a whistle above it: bong bong bong, bong bing bong, bong bing bong, bong bong bong. A whistle answers on the fourth beat and a fanfare turns every fourth bar. Hard snare, slow hats, room to rap.',
            bar: function (bar) {
                var ch = ANTHEM_CHORDS[bar % 4], chant = ANTHEM_CHANT[bar % 4];
                var e, last = bar === 15, bare = bar >= 8 && bar < 10, turn = bar % 4 === 3;
                var K = { hi: 120, lo: 42, bend: 0.1, dur: 0.4, click: true };

                // The chant
                ANTHEM_HITS.forEach(function (b, i) {
                    if (chant[i] === 0) {
                        brass(ch.low, b, 0.85, 0.2, 2200);
                        kick(b, 0.6, { hi: ch.root * 2.2, lo: ch.root, bend: 0.05, dur: 0.75 });
                    } else {
                        flute(ch.bing * 2, b, 0.55, 0.16);
                        bell(ch.bing, b, 0.05);
                    }
                });
                // Whistle answer on the four
                ANTHEM_ANSWER[bar % 4].forEach(function (n) { flute(n[1] * 2, n[0] + SWING, n[2], 0.11); });

                // Drums
                if (!bare) {
                    kick(0, 0.72, K); kick(1.75 + SWING, 0.5, K); kick(2.5 + SWING, 0.62, K);
                    if (bar % 2 === 1) kick(3.5 + SWING, 0.4, K);
                    snare(1, 0.5); clap(1, 0.22); snare(3, 0.52); clap(3, 0.24);
                    for (e = 0; e < 8; e++) hat(e * 0.5 + (e % 2 ? SWING : 0), e % 2 ? 0.07 : 0.11, false);
                    if (bar % 2 === 1) for (e = 0; e < 4; e++) hat(3 + e * 0.25, 0.06, false);
                    hat(2.5 + SWING, 0.1, true);
                    if (turn) { snare(3.5, 0.24); snare(3.75, 0.3); }
                } else {
                    for (e = 0; e < 4; e++) hat(e, 0.06, false);
                    snare(1, 0.28); snare(3, 0.3);
                }
                if (last) for (e = 0; e < 8; e++) snare(2 + e * 0.25, 0.12 + e * 0.04);

                // Sub under the bar
                tone(ch.root, 0, 0.9, 0.42, 'sine', 160, 0.01);
                tone(ch.root, 2.5 + SWING, 0.9, 0.36, 'sine', 160, 0.01);

                // Fanfare on the turnaround: high brass ta-ta-ta-taaa into the next bar
                if (turn) {
                    brass(ch.high, 2.5, 0.2, 0.09, 4000);
                    brass(ch.high, 2.75, 0.2, 0.09, 4000);
                    brass(ch.high, 3, 0.2, 0.1, 4000);
                    brass(ch.high, 3.5, 0.5, 0.12, 4200);
                }
            }
        },
        {
            id: 'anthem2', name: 'Anthem II', bpm: 96, bars: 32, swing: 0.05, bed: 'vinyl', gain: 1.3,
            style: 'Rap, the drums of West Africa',
            blurb: 'The chant returns, louder, over a drum ensemble: dundun bass drums under every bong, a djembe talking in sixteenths, a talking drum that bends between the calls, and a sabar crack on the snare. Four sections of eight bars, each one heavier than the last, the fanfare at the end.',
            bar: function (bar) {
                var ch = ANTHEM_CHORDS[bar % 4], chant = ANTHEM_CHANT[bar % 4];
                var sec = Math.floor(bar / 8), e, last = bar === 31, turn = bar % 4 === 3;
                var djembeOn = sec >= 1, doubleHats = sec >= 2, fullFan = sec === 3;
                var callBar = bar % 8 === 7;
                var K = { hi: 130, lo: 40, bend: 0.1, dur: 0.45, click: true };

                // The chant: every bong also gets a dundun
                ANTHEM_HITS.forEach(function (b, i) {
                    if (chant[i] === 0) {
                        brass(ch.low, b, 0.85, sec >= 2 ? 0.24 : 0.2, 2200);
                        kick(b, 0.62, { hi: ch.root * 2.2, lo: ch.root, bend: 0.05, dur: 0.75 });
                        dundun(b, 0.7, true);
                        if (sec >= 1) dundun(b + 0.02, 0.35, false);
                    } else {
                        flute(ch.bing * 2, b, 0.55, 0.17);
                        bell(ch.bing, b, 0.06);
                        if (sec >= 2) marimba(ch.bing * 2, b, 0.4, 0.09, true);
                        talk(b, 0.28, 180, 300, 0.6);
                    }
                });
                // Whistle answer on the four; from section two the talking drum answers too
                ANTHEM_ANSWER[bar % 4].forEach(function (n) { flute(n[1] * 2, n[0] + SWING, n[2], 0.12); });
                if (sec >= 1) { talk(3, 0.3, 320, 190, 0.45); talk(3.5 + SWING, 0.26, 200, 330, 0.45); }

                // Kit
                kick(0, 0.78, K); kick(1.75 + SWING, 0.52, K); kick(2.5 + SWING, 0.66, K);
                if (bar % 2 === 1) kick(3.5 + SWING, 0.42, K);
                snare(1, 0.54); clap(1, 0.26); djembe(1, 0.5, 'slap');
                snare(3, 0.56); clap(3, 0.28); djembe(3, 0.52, 'slap');
                var hats = doubleHats ? 16 : 8;
                for (e = 0; e < hats; e++) hat(e * (4 / hats) + (e % 2 ? SWING : 0), hats === 16 ? (e % 4 === 0 ? 0.1 : 0.05) : (e % 2 ? 0.07 : 0.11), false);
                hat(2.5 + SWING, 0.1, true);
                for (e = 0; e < 16; e++) shaker(e * 0.25 + (e % 2 ? SWING : 0), e % 4 === 2 ? 0.07 : 0.035);

                // Djembe conversation
                if (djembeOn) ANTHEM2_DJEMBE[bar % 2].forEach(function (h) {
                    djembe(h[0] + (h[0] % 0.5 ? SWING : 0), h[1] === 'bass' ? 0.5 : h[1] === 'slap' ? 0.3 : 0.26, h[1]);
                });
                // Dundun pattern under the section
                dundun(1.75 + SWING, 0.5, false); dundun(3.5 + SWING, 0.42, false);
                if (sec >= 2) dundun(2.75 + SWING, 0.36, true);

                // Sub
                tone(ch.root, 0, 0.9, 0.44, 'sine', 160, 0.01);
                tone(ch.root, 2.5 + SWING, 0.9, 0.38, 'sine', 160, 0.01);

                // Turnarounds: fanfare every fourth bar, a djembe roll every eighth
                if (turn) {
                    brass(ch.high, 2.5, 0.2, 0.1, 4000); brass(ch.high, 2.75, 0.2, 0.1, 4000);
                    brass(ch.high, 3, 0.2, 0.11, 4000); brass(ch.high, 3.5, 0.5, 0.13, 4200);
                    if (fullFan) { brass(ch.high.map(function (f) { return f * 2; }), 3.5, 0.5, 0.06, 5000); }
                }
                if (callBar) for (e = 0; e < 8; e++) djembe(2 + e * 0.25, 0.22 + e * 0.04, e % 2 ? 'slap' : 'tone');
                if (last) { for (e = 0; e < 8; e++) snare(2 + e * 0.25, 0.14 + e * 0.04); dundun(3.75, 0.7, true); }
            }
        },
        {
            id: 'rally', name: 'Rally', bpm: 94, bars: RALLY_BARS, swing: 0.04, bed: 'vinyl', gain: 1.2,
            style: 'Rap, ping pong chant',
            blurb: 'A chant, word for word, one syllable per eighth note with a breath at every full stop. Pong is a log drum and a low brass hit, ping is a kalimba and a whistle blip. The phrases are uneven, seven then seventeen, and the drums hold a straight line under them so the chant is the thing that swerves.',
            bar: function (bar) {
                var ch = RALLY_CHORDS[Math.floor(bar / 4) % 4];
                var e, last = bar === RALLY_BARS - 1;
                var K = { hi: 125, lo: 40, bend: 0.1, dur: 0.42, click: true };

                // The chant
                for (e = 0; e < 8; e++) {
                    var syl = RALLY_SEQ[bar * 8 + e];
                    if (syl === undefined || syl < 0) continue;
                    var off = e * 0.5 + (e % 2 ? SWING : 0);
                    if (syl === 0) {
                        logDrum(ch.root * 2, off, 0.6, 0.6);
                        brass(ch.low, off, 0.38, 0.15, 2000);
                        djembe(off, 0.3, 'bass');
                    } else {
                        marimba(ch.ping, off, 0.4, 0.16, true);
                        flute(ch.ping * 2, off, 0.3, 0.14);
                        bell(ch.ping, off, 0.04);
                    }
                }

                // Drums, straight, so the chant does the swerving
                kick(0, 0.74, K); kick(1.5 + SWING, 0.5, K); kick(2.5 + SWING, 0.64, K);
                if (bar % 2 === 1) kick(3.75, 0.4, K);
                snare(1, 0.52); clap(1, 0.24); snare(3, 0.54); clap(3, 0.26);
                for (e = 0; e < 8; e++) hat(e * 0.5 + (e % 2 ? SWING : 0), e % 2 ? 0.07 : 0.11, false);
                if (bar % 2 === 1) for (e = 0; e < 4; e++) hat(3 + e * 0.25, 0.06, false);
                hat(2.5 + SWING, 0.1, true);
                for (e = 0; e < 16; e++) shaker(e * 0.25 + (e % 2 ? SWING : 0), e % 4 === 2 ? 0.06 : 0.03);
                if (bar % 4 === 3) { snare(3.5, 0.22); snare(3.75, 0.28); }
                dundun(0, 0.5, true); dundun(2.5 + SWING, 0.42, false);

                // Sub
                tone(ch.root, 0, 0.9, 0.42, 'sine', 160, 0.01);
                tone(ch.root, 2.5 + SWING, 0.9, 0.36, 'sine', 160, 0.01);

                // The chant ends five eighths before the loop does: a fanfare and a roll fill the gap
                if (last) {
                    brass(ch.high, 1.5, 0.2, 0.1, 4000); brass(ch.high, 1.75, 0.2, 0.1, 4000);
                    brass(ch.high, 2, 0.2, 0.11, 4000); brass(ch.high, 2.5, 1.2, 0.13, 4200);
                    for (e = 0; e < 8; e++) snare(2 + e * 0.25, 0.12 + e * 0.04);
                    for (e = 0; e < 6; e++) djembe(2.5 + e * 0.25, 0.22 + e * 0.04, e % 2 ? 'slap' : 'tone');
                }
            }
        },
        {
            id: 'rally2', name: 'Rally II', bpm: 94, bars: RALLY_BARS * 2, swing: 0.04, bed: null, gain: 1.4,
            style: 'Rap, big and clean',
            blurb: 'The chant again, built to play loud in a car: a few big things and nothing in between. One 808 that glides under the pongs, a low horn on each pong and the same horn an octave up on each ping, a boom on every pong, a snare like a wall, and hats. No melody over it, no effects. Just the beat and the chant, twice through.',
            bar: function (bar) {
                var cb = bar % RALLY_BARS;
                var ch = RALLY_CHORDS[Math.floor(cb / 4) % 4];
                var e, last = cb === RALLY_BARS - 1;
                var K = { hi: 140, lo: 42, bend: 0.08, dur: 0.5, click: true };
                var pongs = [];

                // The chant: pong is one brass hit, ping is one whistle
                for (e = 0; e < 8; e++) {
                    var syl = RALLY_SEQ[cb * 8 + e];
                    if (syl === undefined || syl < 0) continue;
                    var off = e * 0.5 + (e % 2 ? SWING : 0);
                    if (syl === 0) {
                        pongs.push(off);
                        brass(ch.low, off, 0.42, 0.22, 2400);
                        // Every pong is a boom: a short 808 on the root and a dundun under it
                        kick(off, 0.8, { hi: ch.root * 2.2, lo: ch.root, bend: 0.04, dur: 0.55, click: true });
                        dundun(off, 0.55, true);
                    } else {
                        // Ping is the same horn an octave up, short and bright. A whistle
                        // here was too piercing on speakers.
                        brass(ch.low.map(function (f) { return f * 2; }), off, 0.3, 0.16, 3400);
                    }
                }
                // One 808: root on the one and the and-of-two, a glide into the third pong
                kick(0, 0.9, { hi: ch.root * 2.4, lo: ch.root, bend: 0.04, dur: 1.3 });
                kick(2.5 + SWING, 0.8, { hi: ch.root * 2.4, lo: ch.root, bend: 0.04, dur: 1.0 });
                if (pongs.length > 2 && pongs[2] > 0.6 && pongs[2] < 2.4) kick(pongs[2], 0.6, { hi: ch.root * 1.5, lo: ch.root, bend: 0.25, dur: 0.8 });

                // Kit: punch kick on top of the 808, wall snare, straight hats with one roll
                kick(0, 0.8, K); kick(2.5 + SWING, 0.7, K);
                dundun(0, 0.7, true); dundun(2.5 + SWING, 0.6, true);
                snare(1, 0.75); clap(1, 0.42); dundun(1, 0.4, false);
                snare(3, 0.78); clap(3, 0.44); dundun(3, 0.42, false);
                for (e = 0; e < 8; e++) hat(e * 0.5 + (e % 2 ? SWING : 0), e % 2 ? 0.07 : 0.12, false);
                if (cb % 4 === 3) for (e = 0; e < 6; e++) hat(3 + e / 6, 0.06 + e * 0.012, false);
                hat(2.5 + SWING, 0.1, true);

                // Fanfare and snare roll into the loop
                if (last) {
                    brass(ch.high, 1.5, 0.2, 0.11, 4000); brass(ch.high, 1.75, 0.2, 0.11, 4000);
                    brass(ch.high, 2, 0.2, 0.12, 4000); brass(ch.high, 2.5, 1.2, 0.15, 4200);
                    for (e = 0; e < 8; e++) snare(2 + e * 0.25, 0.14 + e * 0.05);
                }
            }
        }
    ];

    /* ── Shuffle: 100 mixes generated from a seed. Same seed, same mix,
       every time, on every machine, so "Mix 37" means something. ── */

    function rng(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

    var KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    var SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
    var PROGS = {
        major: [[0, 4, 5, 3], [0, 3, 4, 3], [5, 3, 0, 4], [0, 5, 3, 4], [1, 4, 0, 0], [0, 3, 0, 4]],
        minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 6], [0, 2, 6, 5], [0, 3, 0, 6], [5, 6, 0, 0]]
    };
    var DRUMS = [
        { name: 'boom-bap drums', swing: 0.08, K: {}, kick: [0, 1.5], snare: [1, 3], hats: 8, extra: 'ghost' },
        { name: 'house drums', swing: 0.02, K: { hi: 160, lo: 46, bend: 0.07, dur: 0.42, click: true }, kick: [0, 1, 2, 3], clap: [1, 3], hats: 8, open: [0.5, 1.5, 2.5, 3.5] },
        { name: 'afrobeats drums', swing: 0.04, K: { hi: 140, lo: 46, bend: 0.06, dur: 0.34, click: true }, kick: [0, 1.75, 2.5], clap: [1.03, 3.03], shaker: true, rims: [0.5, 1.5, 2.25, 3, 3.5] },
        { name: 'sebene drums', swing: 0, K: { hi: 130, lo: 48, bend: 0.05, dur: 0.24, click: true }, kick: [0, 1.5, 2, 3.5], snare: [1, 3], hats: 8, cowbell: [0, 0.75, 1.5, 2.5, 3.25], rims16: true },
        { name: 'amapiano drums', swing: 0.03, K: { hi: 140, lo: 48, bend: 0.06, dur: 0.3, click: true }, kick: [0, 1.75, 2.5], clap: [1, 3], shaker: true, rims: [0, 0.75, 1.5, 2, 2.5, 3.25], open: [0.5, 1.5, 2.5, 3.5] },
        { name: 'marching drums', swing: 0.02, K: { hi: 150, lo: 50, bend: 0.06, dur: 0.3, click: true }, kick: [0, 1, 2, 3], snare: [1, 3], hats: 16, extra: 'ghost', open: [1.5, 3.5] },
        { name: 'half-time drums', swing: 0.05, K: { hi: 120, lo: 40, bend: 0.12, dur: 0.5 }, kick: [0, 2.5], snare: [2], hats: 8, shaker: true },
        { name: 'conga drums', swing: 0.03, K: { hi: 140, lo: 48, bend: 0.06, dur: 0.3, click: true }, kick: [0, 2], clap: [1, 3], congas: true, shaker: true, cowbell: [0.5, 2.5] }
    ];
    var BASSES = ['sub bass', 'saw bass', 'log drum bass', 'plucked bass', '808 bass', 'organ bass'];
    var CHORDS = ['warm keys', 'pumping pad', 'brass stabs', 'guitar chords', 'organ chords', 'marimba chords', 'no chords'];
    var LEADS = ['flute', 'lead guitar', 'marimba', 'kalimba', 'trumpet', 'square lead', 'bells', 'no lead'];
    var BASS_PATS = [[0, 0.75, 1.5, 2, 2.75, 3.5], [0, 1.5, 2, 3.5], [0.5, 1.5, 2.5, 3.5], [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], [0, 2.5, 3], [0.5, 1, 1.75, 2.5, 3.25]];

    function makeMix(n, seed) {
        var r = rng(seed);
        function pick(a) { return a[Math.floor(r() * a.length)]; }
        var mode = r() < 0.5 ? 'major' : 'minor';
        var keyIdx = Math.floor(r() * 12), scale = SCALES[mode];
        var prog = pick(PROGS[mode]);
        var drums = pick(DRUMS);
        var bassKind = pick(BASSES), chordKind = pick(CHORDS), leadKind = pick(LEADS);
        var bpm = 84 + Math.floor(r() * 34) * 2; // 84 .. 150, even
        var bassPat = pick(BASS_PATS);
        var bed = pick(['vinyl', 'air', 'air', null]);
        var chant = r() < 0.3;
        var kickDrop = r() < 0.5;
        var root = 36 + keyIdx; // C2 and up
        function deg(d, oct) { return midi(root + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7) + 12 * (oct || 0)); }
        var chords = prog.map(function (d) {
            return { root: deg(d, 0), fifth: deg(d + 4, 0), tones: [deg(d, 1), deg(d + 2, 1), deg(d + 4, 1), deg(d + 6, 1)], high: [deg(d, 2), deg(d + 2, 2), deg(d + 4, 2)] };
        });
        // Two-bar hook melody from the pentatonic, a random walk with rests
        var pent = mode === 'major' ? [0, 1, 2, 4, 5] : [0, 2, 3, 4, 6];
        var melody = [], pos = 2 + Math.floor(r() * 3);
        for (var i = 0; i < 16; i++) {
            if (r() < 0.38) { melody.push(null); continue; }
            pos += Math.floor(r() * 5) - 2; pos = Math.max(0, Math.min(9, pos));
            melody.push(deg(pent[pos % 5] + 7 * Math.floor(pos / 5), 2));
        }
        var stabRhythm = pick([[0, 2.5], [1.5, 3.5], [0.5, 1.5, 2.5, 3.5], [0, 1, 2.5, 3], [0.75, 2, 3.25]]);
        var sig = [mode, prog.join(''), drums.name, bassKind, chordKind, leadKind].join('|');
        var style = KEYS[keyIdx] + ' ' + mode + ' · ' + drums.name;
        var blurb = drums.name + ', ' + bassKind + ', ' + chordKind + ', ' + leadKind + (chant ? ', a crowd chant' : '') + (kickDrop ? ', kick drop at bar 8' : '') + '. ' + KEYS[keyIdx] + ' ' + mode + ', ' + bpm + ' BPM.';

        return {
            id: 'mix-' + n, name: 'Mix ' + n, bpm: bpm, bars: 16, swing: drums.swing, bed: bed, style: style, blurb: blurb, sig: sig, seed: seed,
            bar: function (bar) {
                var ch = chords[bar % 4], e, last = bar === 15, drop = kickDrop && bar >= 8 && bar < 10;
                var K = drums.K;
                // Drums
                if (!drop) drums.kick.forEach(function (o) { kick(o + (o % 1 ? drums.swing : 0), o === 0 ? 0.7 : 0.55, K); });
                if (drums.snare) drums.snare.forEach(function (o) { snare(o, 0.44); });
                if (drums.clap) drums.clap.forEach(function (o) { clap(o, 0.32); });
                if (drums.hats) for (e = 0; e < drums.hats; e++) hat(e * (4 / drums.hats) + (e % 2 ? drums.swing : 0), drums.hats === 16 ? 0.035 : (e % 2 ? 0.06 : 0.1), false);
                if (drums.open) drums.open.forEach(function (o) { hat(o + drums.swing, 0.12, true); });
                if (drums.shaker) for (e = 0; e < 16; e++) shaker(e * 0.25 + (e % 2 ? drums.swing : 0), e % 4 === 2 ? 0.075 : 0.04);
                if (drums.rims) drums.rims.forEach(function (o) { rim(o + drums.swing, 0.08); });
                if (drums.rims16) for (e = 0; e < 16; e++) if (e % 2) rim(e * 0.25, 0.05);
                if (drums.cowbell) drums.cowbell.forEach(function (o) { rim(o, 0.11, 820, 0.09); });
                if (drums.congas) { conga(0.5, 0.3, 190); conga(1.5, 0.34, 190, true); conga(2.25, 0.28, 240); conga(2.75, 0.3, 190); conga(3.5, 0.36, 240, true); }
                if (drums.extra === 'ghost' && bar % 2 === 1) snare(3.75, 0.16);
                if (bar % 4 === 3) { snare(3.5, 0.2); snare(3.75, 0.26); }
                if (last) for (e = 0; e < 8; e++) snare(2 + e * 0.25, 0.1 + e * 0.03);
                // Bass
                if (!drop) bassPat.forEach(function (o, i) {
                    var f = i % 3 === 2 ? ch.fifth : ch.root, so = o + (o % 1 ? drums.swing : 0);
                    if (bassKind === 'sub bass') tone(f, so, 0.6, 0.55, 'sine', 220, 0.008);
                    else if (bassKind === 'saw bass') sawBass(f * 2, so, 0.45, 0.4, 900, 180);
                    else if (bassKind === 'log drum bass') logDrum(f, so, 0.7, 0.6);
                    else if (bassKind === 'plucked bass') pluck(f * 2, so, 0.5, 0.3, 1800);
                    else if (bassKind === '808 bass') { if (i % 2 === 0) kick(so, 0.6, { hi: f * 2.5, lo: f, bend: 0.05, dur: 0.9 }); }
                    else organ([f * 2], so, 0.5, 0.2);
                });
                // Chords
                if (chordKind === 'warm keys') ch.tones.forEach(function (f) { tone(f, 0, 2.6, 0.07, 'triangle', 1100, 0.04); tone(f, 2.5 + drums.swing, 1.1, 0.045, 'triangle', 900, 0.03); });
                else if (chordKind === 'pumping pad') pad(ch.tones, 0, 4, 0.08, 1500, true);
                else if (chordKind === 'brass stabs') stabRhythm.forEach(function (o) { brass(ch.tones.slice(0, 3), o, 0.45, 0.12, 3000); });
                else if (chordKind === 'guitar chords') stabRhythm.forEach(function (o) { ch.tones.forEach(function (f, i) { pluck(f, o + i * 0.02, 0.5, 0.07, 3600); }); });
                else if (chordKind === 'organ chords') organ(ch.tones.slice(0, 3), 0, 3.9, 0.07);
                else if (chordKind === 'marimba chords') for (e = 0; e < 8; e++) marimba(ch.tones[e % 4], e * 0.5 + (e % 2 ? drums.swing : 0), 0.5, 0.09);
                // Lead, a two-bar hook that repeats, dropped in the drop
                if (leadKind !== 'no lead' && !drop) {
                    var half = bar % 2 ? 8 : 0;
                    for (e = 0; e < 8; e++) {
                        var f = melody[half + e]; if (!f) continue;
                        var len = 0.5; while (e + 1 < 8 && !melody[half + e + 1] && len < 1.5) len += 0.5;
                        var so = e * 0.5 + (e % 2 ? drums.swing : 0);
                        if (leadKind === 'flute') flute(f, so, len, 0.09);
                        else if (leadKind === 'lead guitar') pluck(f, so, len, 0.11, 5000);
                        else if (leadKind === 'marimba') marimba(f, so, len, 0.12);
                        else if (leadKind === 'kalimba') marimba(f * 2, so, len, 0.1, true);
                        else if (leadKind === 'trumpet') brass([f], so, len, 0.12, 3600);
                        else if (leadKind === 'square lead') tone(f, so, len, 0.05, 'square', 1800, 0.004);
                        else if (leadKind === 'bells' && e % 2 === 0) bell(f, so, 0.08);
                    }
                }
                if (chant && bar % 2 === 1) { voice(ch.high[0] / 2, 3, 0.45, 0.13); voice(ch.high[0] / 2, 3.5, 0.5, 0.15); }
                if (kickDrop && bar === 9) riser(0, 4, 0.12);
            }
        };
    }

    // Seeds walk upward until 100 mixes have distinct instrument line-ups.
    // Built on first use only: the public pages never ask for them. The
    // studio page (unlisted, for the lab) is where they live.
    var MIXES = null;
    function getMixes() {
        if (MIXES) return MIXES;
        MIXES = []; var mixSeed = 1, seen = {};
        while (MIXES.length < 100) {
            var cand = makeMix(MIXES.length + 1, mixSeed++);
            if (seen[cand.sig]) continue;
            seen[cand.sig] = true;
            MIXES.push(cand);
        }
        return MIXES;
    }
    function mixByNumber(n) { n = Math.max(1, Math.min(100, parseInt(n, 10) || 1)); return getMixes()[n - 1]; }

    function trackById(id) {
        if (id && id.indexOf('mix-') === 0) return mixByNumber(id.slice(4));
        for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i];
        for (var j = 0; j < TRACKS.length; j++) if (TRACKS[j].id === DEFAULT_TRACK) return TRACKS[j];
        return TRACKS[0];
    }
    function loadTrack(t) {
        current = t;
        BEAT = 60 / t.bpm; BARS = t.bars; SWING = t.swing; DUR = BARS * 4 * BEAT;
        // Beat-timed CSS (the mascot bop) follows the tempo of the chosen track.
        document.documentElement.style.setProperty('--beat', BEAT.toFixed(4) + 's');
    }

    /* ── Player ── */

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    function scheduleBar(bar, barTime) {
        barBase = barTime;
        current.bar(bar);
    }

    function pump() {
        while (nextBarTime < ctx.currentTime + LOOKAHEAD) {
            scheduleBar(curBar, nextBarTime);
            nextBarTime += 4 * BEAT;
            curBar = (curBar + 1) % BARS;
        }
    }

    function setUI() {
        var on = playing;
        if (glyph) glyph.textContent = on ? '❚❚' : '►';
        if (btn) {
            btn.setAttribute('aria-label', on ? 'Pause ' + current.name : 'Play ' + current.name);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.title = current.name + ' · ' + current.bpm + ' BPM';
        }
        document.documentElement.classList.toggle('sound-playing', on);
        var isMix = current.id.indexOf('mix-') === 0;
        var items = document.querySelectorAll('.beats-menu [data-track-pick]');
        for (var k = 0; k < items.length; k++) {
            var pid = items[k].getAttribute('data-track-pick');
            var hit = current.id === pid;
            items[k].classList.toggle('is-current', hit);
            items[k].classList.toggle('is-playing', on && hit);
            items[k].setAttribute('aria-checked', hit ? 'true' : 'false');
        }
        var shuf = document.querySelector('[data-mix-card]');
        if (shuf) {
            var m = isMix ? current : (shownMix || mixByNumber(1));
            shownMix = m;
            shuf.setAttribute('data-track', m.id);
            shuf.querySelector('[data-mix-name]').textContent = m.name;
            shuf.querySelector('[data-mix-meta]').textContent = m.bpm + ' BPM · ' + m.style;
            shuf.querySelector('[data-mix-blurb]').textContent = m.blurb;
            var inp = shuf.querySelector('[data-mix-jump]'); if (inp && document.activeElement !== inp) inp.value = m.seed ? m.id.slice(4) : '';
        }
        var cards = document.querySelectorAll('[data-track]');
        for (var i = 0; i < cards.length; i++) {
            var id = cards[i].getAttribute('data-track');
            var isOn = on && current.id === id;
            cards[i].classList.toggle('is-playing', isOn);
            cards[i].classList.toggle('is-current', current.id === id);
            var p = cards[i].querySelector('[data-track-play]');
            if (p) {
                p.setAttribute('aria-pressed', isOn ? 'true' : 'false');
                p.setAttribute('aria-label', (isOn ? 'Pause ' : 'Play ') + trackById(id).name);
                var g = p.querySelector('span'); if (g) g.textContent = isOn ? '❚❚' : '►';
            }
        }
    }

    function buildChain(c) {
        var m = c.createGain(); m.gain.value = 0.6 * (current && current.gain || 1);
        var cp = c.createDynamicsCompressor();
        cp.threshold.value = -16; cp.knee.value = 8; cp.ratio.value = 4;
        cp.attack.value = 0.004; cp.release.value = 0.25;
        // Brick wall after the track gain, so the loud tracks stay loud
        // without the WAV clipping. Only bites above -2 dB.
        var lim = c.createDynamicsCompressor();
        lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20;
        lim.attack.value = 0.001; lim.release.value = 0.08;
        cp.connect(m); m.connect(lim);
        return { master: m, comp: cp, out: lim };
    }

    async function start() {
        if (playing) return true;
        var c = getCtx();
        try { await c.resume(); } catch (e) { /* ignore */ }
        if (c.state !== 'running' || playing) return false;
        try { localStorage.setItem('artivicolab.beats', 'on'); } catch (e) { /* ignore */ }

        var chain = buildChain(c);
        master = chain.master; comp = chain.comp;
        var out = chain.out;

        // Route through exactly one destination (MediaStream on iOS so the silent switch is ignored).
        var routed = false;
        if (typeof c.createMediaStreamDestination === 'function') {
            try {
                streamDest = c.createMediaStreamDestination();
                out.connect(streamDest);
                routerAudio = new Audio();
                routerAudio.playsInline = true;
                routerAudio.setAttribute('playsinline', '');
                routerAudio.srcObject = streamDest.stream;
                await routerAudio.play();
                routed = true;
            } catch (e) {
                try { out.disconnect(streamDest); } catch (e2) { /* ignore */ }
                streamDest = null; routerAudio = null;
            }
        }
        if (!routed) out.connect(c.destination);

        snareBuf = noise(0.03); hatBuf = noise(0.006);
        if (current.bed && BEDS[current.bed]) { bedSrc = BEDS[current.bed](); bedSrc.start(); }

        startTime = c.currentTime + 0.3;
        nextBarTime = startTime; curBar = 0;
        pump();

        sessionStart = c.currentTime;
        playing = true;
        setUI();
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
        if (bedSrc) { try { bedSrc.stop(ctx.currentTime + 1); } catch (e) { /* ignore */ } bedSrc = null; }
        if (routerAudio) { var ra = routerAudio; routerAudio = null; setTimeout(function () { try { ra.pause(); } catch (e) { /* ignore */ } }, 900); }
        setUI();
        if (prog) setTimeout(function () { prog.style.width = '0%'; }, auto ? 1200 : 400);
    }

    function choose(id) {
        var t = trackById(id);
        try { localStorage.setItem('artivicolab.track', t.id); } catch (e) { /* ignore */ }
        if (playing && current !== t) {
            stop(false);
            loadTrack(t);
            // Let the fade finish before the new loop takes the same clock.
            return new Promise(function (res) { setTimeout(function () { start().then(res); }, 450); });
        }
        loadTrack(t);
        setUI();
        return Promise.resolve(false);
    }

    /* ── Download: render one full loop offline and pack it as a WAV. ── */

    function wavBlob(buffer) {
        var chs = buffer.numberOfChannels, len = buffer.length, rate = buffer.sampleRate;
        var bytes = 44 + len * chs * 2, ab = new ArrayBuffer(bytes), v = new DataView(ab);
        function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
        str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE');
        str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, chs, true);
        v.setUint32(24, rate, true); v.setUint32(28, rate * chs * 2, true); v.setUint16(32, chs * 2, true); v.setUint16(34, 16, true);
        str(36, 'data'); v.setUint32(40, len * chs * 2, true);
        var o = 44, data = [];
        for (var c = 0; c < chs; c++) data.push(buffer.getChannelData(c));
        for (var i = 0; i < len; i++) for (var c2 = 0; c2 < chs; c2++) {
            var s = Math.max(-1, Math.min(1, data[c2][i]));
            v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2;
        }
        return new Blob([ab], { type: 'audio/wav' });
    }

    async function render(id) {
        if (rendering) return null;
        var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!Offline) return null;
        rendering = true;
        var t = trackById(id);
        var beat = 60 / t.bpm, dur = t.bars * 4 * beat, rate = 44100;
        var off = new Offline(1, Math.ceil(rate * (dur + 0.2)), rate);

        // Swap the engine onto the offline context for the scheduling pass.
        // Scheduling is synchronous, so the live player never sees the swap.
        var saved = { ctx: ctx, comp: comp, master: master, barBase: barBase, BEAT: BEAT, SWING: SWING, BARS: BARS, snareBuf: snareBuf, hatBuf: hatBuf, current: current };
        ctx = off; BEAT = beat; SWING = t.swing; BARS = t.bars; current = t;
        var chain = buildChain(off); comp = chain.comp; master = chain.master;
        chain.out.connect(off.destination);
        snareBuf = noise(0.03); hatBuf = noise(0.006);
        var bed = null;
        if (t.bed && BEDS[t.bed]) { bed = BEDS[t.bed](); bed.start(0); bed.stop(dur); }
        for (var b = 0; b < t.bars; b++) { barBase = 0.1 + b * 4 * beat; t.bar(b); }
        // Fade the very end so the loop point does not click on a single play.
        master.gain.setValueAtTime(0.6 * (t.gain || 1), dur + 0.1); master.gain.linearRampToValueAtTime(0, dur + 0.2);

        ctx = saved.ctx; comp = saved.comp; master = saved.master; barBase = saved.barBase;
        BEAT = saved.BEAT; SWING = saved.SWING; BARS = saved.BARS; snareBuf = saved.snareBuf; hatBuf = saved.hatBuf; current = saved.current;

        try {
            var buf = await off.startRendering();
            return wavBlob(buf);
        } finally { rendering = false; }
    }

    async function download(id, el) {
        var t = trackById(id);
        var label = el ? el.textContent : '';
        if (el) { el.disabled = true; el.textContent = 'Rendering…'; }
        try {
            var blob = await render(t.id);
            if (!blob) { if (el) el.textContent = 'Not supported here'; return; }
            var url = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = url; a.download = 'artivicolab-' + t.id + '-' + t.bpm + 'bpm.wav';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        } finally {
            if (el) { el.disabled = false; if (el.textContent === 'Rendering…') el.textContent = label; }
        }
    }

    /* ── Wiring ── */

    var chosen = DEFAULT_TRACK;
    try { chosen = localStorage.getItem('artivicolab.track') || chosen; } catch (e) { /* ignore */ }
    loadTrack(trackById(chosen));

    /* ── Footer picker: hover with a mouse, long-press with a finger, or
       the chevron. Built here so no page needs new markup. ── */

    var wrap = null, menu = null, openTimer = null, closeTimer = null, pressTimer = null, suppressClick = false;

    function menuOpen(yes) {
        if (!wrap) return;
        clearTimeout(openTimer); clearTimeout(closeTimer);
        wrap.classList.toggle('is-open', yes);
        var chev = wrap.querySelector('.beats-chevron');
        if (chev) chev.setAttribute('aria-expanded', yes ? 'true' : 'false');
        if (yes) {
            var cur = menu.querySelector('.is-current');
            if (cur && document.activeElement !== btn) cur.focus();
        }
    }

    function buildMenu() {
        if (!btn || !btn.parentNode) return;
        wrap = document.createElement('span');
        wrap.className = 'beats-wrap';
        btn.parentNode.insertBefore(wrap, btn);
        wrap.appendChild(btn);

        var chev = document.createElement('button');
        chev.type = 'button'; chev.className = 'beats-chevron';
        chev.setAttribute('aria-label', 'Choose a sound'); chev.setAttribute('aria-haspopup', 'menu'); chev.setAttribute('aria-expanded', 'false');
        chev.innerHTML = '<span aria-hidden="true">&#9652;</span>';
        wrap.appendChild(chev);

        menu = document.createElement('div');
        menu.className = 'beats-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Sounds');
        var html = '<p class="beats-menu-title">Pick a sound</p>';
        TRACKS.forEach(function (t) {
            html += '<button type="button" role="menuitemradio" aria-checked="false" data-track-pick="' + t.id + '">' +
                '<span class="beats-menu-name">' + t.name + '</span>' +
                '<span class="beats-menu-meta">' + t.bpm + ' BPM · ' + t.style + '</span></button>';
        });
        html += '<a class="beats-menu-more ink-link" href="sounds.html">All sounds, with downloads</a>';
        menu.innerHTML = html;
        wrap.appendChild(menu);

        // Mouse: hover opens, leaving closes after a beat
        wrap.addEventListener('mouseenter', function () {
            clearTimeout(closeTimer);
            openTimer = setTimeout(function () { menuOpen(true); }, 120);
        });
        wrap.addEventListener('mouseleave', function () {
            clearTimeout(openTimer);
            closeTimer = setTimeout(function () { menuOpen(false); }, 260);
        });

        // Finger: press and hold the play button. A short tap still toggles play.
        function pressStart(ev) {
            if (ev.pointerType === 'mouse') return;
            suppressClick = false;
            clearTimeout(pressTimer);
            pressTimer = setTimeout(function () { suppressClick = true; menuOpen(true); }, 420);
        }
        function pressEnd() { clearTimeout(pressTimer); }
        btn.addEventListener('pointerdown', pressStart);
        ['pointerup', 'pointercancel', 'pointerleave', 'touchend', 'touchcancel', 'touchmove'].forEach(function (n) {
            btn.addEventListener(n, pressEnd, { passive: true });
        });
        btn.addEventListener('contextmenu', function (ev) { if (wrap.classList.contains('is-open')) ev.preventDefault(); });

        chev.addEventListener('click', function () { menuOpen(!wrap.classList.contains('is-open')); });

        menu.addEventListener('click', function (ev) {
            var pick = ev.target.closest('[data-track-pick]');
            if (!pick) return;
            var id = pick.getAttribute('data-track-pick');
            choose(id).then(function (started) { if (!started && !playing) start(); });
            menuOpen(false);
            btn.focus();
        });

        document.addEventListener('click', function (ev) {
            if (wrap.classList.contains('is-open') && !wrap.contains(ev.target)) menuOpen(false);
        });
        document.addEventListener('keydown', function (ev) {
            if (!wrap.classList.contains('is-open')) {
                if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && document.activeElement === btn) { ev.preventDefault(); menuOpen(true); }
                return;
            }
            var items = Array.prototype.slice.call(menu.querySelectorAll('[data-track-pick]'));
            var i = items.indexOf(document.activeElement);
            if (ev.key === 'Escape') { menuOpen(false); btn.focus(); }
            else if (ev.key === 'ArrowDown') { ev.preventDefault(); items[(i + 1) % items.length].focus(); }
            else if (ev.key === 'ArrowUp') { ev.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        });
    }

    buildMenu();

    if (btn) btn.addEventListener('click', function () {
        if (suppressClick) { suppressClick = false; return; }
        if (playing) {
            stop(false);
            try { localStorage.setItem('artivicolab.beats', 'off'); } catch (e) { /* ignore */ }
        } else {
            start();
        }
    });

    document.addEventListener('click', function (ev) {
        var p = ev.target.closest && ev.target.closest('[data-track-play]');
        if (p) {
            var card = p.closest('[data-track]'), id = card ? card.getAttribute('data-track') : p.getAttribute('data-track-play');
            if (playing && current.id === id) { stop(false); return; }
            choose(id).then(function (started) { if (!started && !playing) start(); });
            return;
        }
        var mv = ev.target.closest && ev.target.closest('[data-mix-prev], [data-mix-next], [data-mix-random]');
        if (mv) {
            var cur = parseInt((shownMix || mixByNumber(1)).id.slice(4), 10), nxt;
            if (mv.hasAttribute('data-mix-prev')) nxt = cur <= 1 ? 100 : cur - 1;
            else if (mv.hasAttribute('data-mix-next')) nxt = cur >= 100 ? 1 : cur + 1;
            else { do { nxt = 1 + Math.floor(Math.random() * 100); } while (nxt === cur); }
            showMix(nxt);
            return;
        }
        var d = ev.target.closest && ev.target.closest('[data-track-download]');
        if (d) {
            var dc = d.closest('[data-track]'), did = dc ? dc.getAttribute('data-track') : d.getAttribute('data-track-download');
            download(did, d);
        }
    });

    function showMix(n) {
        var m = mixByNumber(n);
        var wasPlaying = playing && current.id.indexOf('mix-') === 0;
        shownMix = m;
        if (wasPlaying) choose(m.id); else setUI();
    }
    document.addEventListener('change', function (ev) {
        if (ev.target.matches && ev.target.matches('[data-mix-jump]')) showMix(ev.target.value);
    });
    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && ev.target.matches && ev.target.matches('[data-mix-jump]')) { ev.preventDefault(); showMix(ev.target.value); ev.target.blur(); }
    });

    setUI();

    window.ArtivicoBeats = { tracks: TRACKS, mixes: getMixes, mix: mixByNumber, choose: choose, start: start, stop: function () { stop(false); }, download: download };
    // No autoplay by design: the beat starts only from a button.
})();
