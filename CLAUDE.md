# CLAUDE.md

Notes for whoever (human or Claude) works on this repo next.

## Runway lights

Approach lighting down both page gutters, at the end of `styles.css` under
a `RUNWAY LIGHTS` banner. Permanent site decor, unrelated to the gate and
deliberately outside the IP-GATE markers, so removing the gate leaves it
alone.

Built from `body::before` and `body::after` only, so no page markup is
involved. A repeating radial-gradient mask turns two flat gradients into a
column of lamps: the steady layer is coloured by aviation convention,
green at the threshold, amber along the edges, red at the runway end, and
a gold strobe slides underneath the mask so the lamps stay put while the
light runs up through them.

Two things worth keeping:

- The strobe is saturated gold, not white. On cream paper a near-white
  highlight is invisible, so a lamp has to read as brighter by getting
  richer rather than lighter.
- One wave every six seconds. Real approach strobes fire about twice a
  second, which on a page people are reading would be irritating and a
  genuine photosensitivity risk. There is a reduced-motion rule that stops
  the sequence and leaves the lamps steady. Do not speed this up.

Runs at every width. Wide screens get 12px rails inset 22px into the
gutter; below 1180px they slim to 7px hard against the edge with smaller,
tighter lamps, measured clear of the text at 360px and up.

## The departure

Under a `THE DEPARTURE` banner in the same file. Every 45 seconds a plan
view airliner, drawn as an ink silhouette, rolls up the page between the
two rails, accelerating the way a real takeoff roll does, then rotates and
climbs away growing toward the viewer as it fades. It hangs off
`main::before`, which every page has, so again no markup. It sits at
z-index -1, behind every word and above the paper texture, at around 13%
opacity on desktop and 9% on phones where text has nowhere to hide.

**Verifying animation in this repo:** headless screenshots capture CSS
animations at their first frame, so anything that starts transparent looks
broken in a screenshot even when it is perfect in a browser. Chasing that
wasted a while. Sample `getComputedStyle` at several timestamps instead,
which does advance. The departure was confirmed that way: it covers 102,
167, 269 and 414 pixels in successive three second intervals, which is the
acceleration curve, not a constant glide.

## Sounds, the footer beat and sounds.html

`assets/js/beats.js` is the whole thing: a Web Audio synth with no samples,
no libraries and nothing fetched. The footer play button on every page and
the list on `sounds.html` both drive it. Styles are under the `Sounds page`
banner in `styles.css`.

Ten loops live in the `TRACKS` table, each a `bar(b)` function that calls
the shared instruments (kick, snare, clap, hat, shaker, rim, tone, sawBass,
logDrum, brass, flute, pluck, voice, pad, riser) at beat offsets inside bar `b`:

- **Crackle**, 84 BPM, lo-fi boom-bap with the vinyl crackle bed. This is
  the original footer beat, unchanged.
- **Stride**, 126 BPM, deep house. Four on the floor, claps, offbeat bass,
  sidechain-style pumping pad.
- **Sprint**, 148 BPM, log drum afro-tech. Broken kick, sixteenth shakers,
  clave, amapiano log drum bass.
- **Parade**, 132 BPM, major key brass fanfare with a flute lead. The
  intro is a solo trumpet call over a snare roll, then stabs on every chord.
- **Rumba**, 138 BPM, Congolese sebene. Two plucked guitars in sixteenths
  (mi-solo arpeggio plus a lead riff), cowbell, skipping sine bass, a crowd
  shout on the turnaround, a two-bar kick drop at bar 8.
- **Bounce**, 104 BPM, Afrobeats. Log drum hook, swung shakers, late claps,
  whistle line, crowd "oh" every second bar.
- **Anthem**, 92 BPM, rap beat whose hook is a chant asked for as
  "bong bong bong, bong bing bong": bong is a low brass hit with an 808
  under it, bing a whistle. Whistle answer on beat four, fanfare on the
  turnaround, 16 bars with no intro. The site default.
- **Anthem II**, 96 BPM, the same chant over a West African ensemble:
  dundun under every bong, djembe in sixteenths, talking drum between the
  calls. 32 bars in four sections that each add weight. Carries
  `gain: 1.3`, the per-track master gain added for it.
- **Rally**, 94 BPM, a chant dictated word for word ("pong pong ping
  pong...") parsed from `RALLY_TEXT` at load: one syllable per eighth, a
  rest at each full stop, bar count derived from the text. Change the
  text and the loop reshapes itself. 17 bars.
- **Rally II**, 94 BPM, the same chant sequence, big and clean: one
  gliding 808, one brass hit per pong, the same brass an octave up per
  ping (a whistle there was "annoying as hell" on speakers), wall snare,
  hats, fanfare into the loop. Two passes, 34
  bars, `gain: 1.3`, no bed. Two earlier versions were cut down by Gradi:
  the first stacked djembe, dundun, choir, shakers and bells ("too busy
  for a car"); the second kept a whistle melody with vibrato over the
  chant, a low whistle harmony and an airhorn, which read as "alien" and
  "cemetery". No melody over the chant, no effects. Keep it sparse.
  `airhorn` and `impact` stay in the instrument set, unused by any track.

Rumba and Bounce were asked for as short-video music (2026-09-30), so
they are 16 bars with no intro: the hook lands on beat one. The other
four keep the intro / full / breakdown shape.

The first four are 32 bars: four-bar intro, twenty-four full, four-bar breakdown
with a riser, so the loop point lands as a drop. Whichever track was chosen
last is remembered in `localStorage` under `artivicolab.track` and the
footer plays that one on every page. A visitor with no choice stored
gets `DEFAULT_TRACK`, which is Anthem (Gradi's pick, 2026-09-30). The `--beat` custom property on
`<html>` is set from the track's tempo, so the mascot bop and the play
button pulse follow whatever is playing.

**Studio, unlisted.** `studio.html` is for the lab, not visitors: noindex,
not linked from any page, not in the sitemap. It exposes the mix
generator in `beats.js`: `makeMix(n, seed)` builds a 16-bar loop from a
seeded choice of drum style, bass, chord voice, lead, key, mode, tempo,
bass pattern and a two-bar pentatonic hook. `getMixes()` walks seeds
upward until 100 mixes have distinct instrument line-ups and is only
called on the studio page, so public pages never pay for it. Mix numbers
are stable: the same number gives the same mix on any machine. A mix
chosen there becomes the footer track like any other (`mix-37` in
localStorage) and downloads the same way. Instruments added for it:
marimba (also kalimba), organ, conga, bell, djembe, dundun, talking drum.

**Footer picker.** The script wraps the footer play button in a
`.beats-wrap` and injects a `.beats-menu` listing every track, plus a
small chevron. It opens on hover with a mouse, on a 420 ms press with a
finger (the click that follows a long press is swallowed so it does not
also toggle play), from the chevron, and from the arrow keys when the play
button has focus. Escape or clicking outside closes it. When testing
touch over the DevTools protocol, use `Input.synthesizeTapGesture` for a
tap: a raw touchStart/touchEnd pair is held for two seconds by Chrome and
reads as a long press.

**Output chain.** Every instrument feeds a compressor (threshold -16 dB,
4:1), then the per-track gain, then a brick-wall limiter (threshold -2 dB,
20:1, 1 ms attack) added on 2026-09-30 when Rally II at `gain: 1.45`
clipped the WAV. The limiter only bites above -2 dB, so the quiet tracks
are untouched. Both the live chain and the offline render use it.

**Download** renders the same bar functions into an `OfflineAudioContext`
(engine state is swapped onto it for the synchronous scheduling pass, then
swapped back), packs the result as 16-bit mono 44.1 kHz WAV in the tab, and
hands the browser a blob. No server. Files are 4 to 8 MB. `stop()` captures
its own router `<audio>` before the delayed pause, so switching tracks
mid-play does not silence the new one.

**Verifying audio in this repo:** headless Chrome can render every track
offline. The scratch harness used on 2026-09-30 drove Chrome over the
DevTools protocol, rendered each track through the download path, and
checked duration, RMS, peak and per-bar loudness. Crackle 91.6 s, Stride
61.2 s, Sprint 52.1 s, Parade 58.4 s, peaks under 0.6, no dead bars. Do that rather than
listening by proxy through a screenshot.

To add a loop: append to `TRACKS` with a dictionary-word id, then add a
matching `<li data-track="id">` card on `sounds.html`. Nothing else needs
wiring.

## The welcome: puzzle, then the listening room

Three files, in this order on every page, and the order matters:
`puzzle.js`, `gate.js`, `beats.js`.

1. **`assets/js/puzzle.js`** Four runway lamps flash a sequence, the
   visitor taps it back. A component, not a decision maker: `open(onDone,
   onWin)` and that is all. `gate.js` decides who sees it.
2. **`assets/js/gate.js`** The listening room. Parade plays twice while
   the lab's story is on screen and a clock counts down. At zero the lock
   pops, ACCESS GRANTED, in you go.
3. Access lasts **one hour**, stored as a timestamp in
   `artivicolab_access_until`. When it lapses the whole welcome plays
   again. The inline pre-paint script in every page reads the same key, so
   change it in both places or returning visitors get a flash of the site.

**Sound is mandatory and the clock proves it.** The timer does not count
wall-clock seconds. Every 200ms it asks `ArtivicoBeats.isPlaying()` and
`ArtivicoBeats.level()`, and only adds the elapsed time if real signal is
coming out of the output. Pause the footer player, block autoplay, or
switch tabs in a way that suspends the audio clock and the countdown stops
dead, the bar greys out, and a red "Turn the sound on" button appears.
There is no path to the site that does not go through hearing Parade twice.
`level()` is an AnalyserNode tapped off the limiter in `beats.js`, added
for exactly this. Hardware volume at zero is not detectable from
JavaScript by anyone, so that is the one hole and it cannot be closed.

**Audio has to start inside a user gesture** or iOS refuses. That is why
`puzzle.js` takes an `onWin` callback and fires it synchronously inside
the winning tap, still in the gesture, and why `gate.js` passes
`primeAudio` into it. Do not move that call into a timeout.

`primeAudio` saves the visitor's chosen footer track before switching to
Parade and `restoreTrack` puts it back at grant time, so the welcome does
not quietly overwrite their pick. It captures that track only on the
first call, because the "Turn the sound on" button can prime again and
would otherwise save Parade over their choice.

**The music stops when the overlay goes.** `dismiss()` calls
`ArtivicoBeats.stop()`. Leaving it running meant Parade played on in the
background while the visitor read the site.

**The double-sound saga, and why it cannot come back.** Gradi heard the
same loop twice, a beat apart, three times over on 2026-10-06. Each time
a real cause was found and fixed, and the last fix changed the design so
the class of bug is gone, not just the instances:

- `beats.js` holds exactly one running chain in `live`. `start()` kills
  whatever is in `live` before building, `stop()` kills it, and nothing
  else holds a reference. `kill()` fades the chain, then disconnects
  every node and releases the router `<audio>`, so notes it had already
  scheduled cannot be heard. The `starting` flag closes the window
  between `start()`'s first `await` and `playing` going true, and after
  the router spins up `start()` checks `live` again and bails if a stop
  landed meanwhile.
- `ArtivicoBeats.play(id)` is the only call other scripts should make.
  It does the choose-then-start dance correctly, synchronously up to the
  first await so it works inside a tap on iOS. The gate used to pair
  `choose()` and `start()` by hand, and `choose()` already restarts the
  player when swapping tracks, which was cause number one.
- A cross-tab lock: a `BroadcastChannel` plus the `storage` event on
  `artivicolab.beats.owner`. Whichever tab starts last wins and every
  other tab stops. Two tabs or windows of the site, each with its own
  player, was the one cause no in-page fix could touch, and it is the
  likely reason the report kept coming back after the in-page fixes.

The test for all of it wraps `createDynamicsCompressor` to count chains
built and chains still connected: after any sequence of `play()`,
`start()`, footer clicks and a track swap, at most one chain may remain
on the graph, and a single `stop()` must leave zero.

**Footer "Replay the welcome"** (`[data-access-replay]`, next to the old
`[data-gate-open]` link, both wired to the same thing) clears access and
runs the whole flow on demand.

**The mercy rule still applies to the puzzle only.** Three misses and the
visitor goes through to the listening room. It does not apply to the
listen, which is the point of it. The old IP gate locked real people out
for days in September 2026; the puzzle is a greeting, but the listen is a
deliberate toll and Gradi asked for it twice, explicitly, including
"audio is required, no blocking nor muting".

Know the cost: two minutes of forced audio before any content is a heavy
toll on a public site, and a visitor who leaves during it counts against
the page in search. The overlay is script-only and the page underneath is
complete HTML, so crawlers still index everything.

Do not claim anything about Gradi's education in this copy. An early
draft said "no computer science degree, no bootcamp", which is untrue (he
holds a degree from Georgia State) and he asked for degrees to stay out
of it. "Self-taught" and "ten thousand hours" are the framing he wants.

Accessibility: lamps are real buttons, Tab cycles them, Escape is ignored
by design, a hidden live region names each lamp as it lights, and the
listening room's note is a live region so a screen reader hears when the
clock stops.

## Visitor Scan, the demo in the footer

`assets/js/ip-gate.js`, wired into every page inside `<!-- IP-GATE:START -->`
and `<!-- IP-GATE:END -->` markers, with its styles in the matching block in
`styles.css`.

**Nothing on this site is gated, and this file gates nothing.** It is a
showpiece. A visitor presses VISITOR SCAN in the footer and gets a staged
scan: the address revealed character by character, a live readout of what
their own browser volunteers, a rough location from a public lookup, and a
specimen plate that classifies them as *Homo staticus* and credits the
curator. It ends on a card saying access was never in question, offering
the arcade refusal as the other ending if they want to see it.

Both endings play the full sequence. The refusal is worth nothing without
the build up in front of it, so asking for it replays the scan and lands
on ACCESS DENIED rather than cutting straight to the arcade. The retry
button on that screen replays it too, which is what makes spending the
three lives feel like something.

### History, so nobody repeats it

This started on 2026-09-18 as a genuine attempt to show the site only to
two IP addresses. It never worked as access control and never could: a
static host serves the file before anything can check who is asking, so
the markup was always one view-source away. Worse, it was left switched on
past its removal date, and for several days every real visitor to
artivicolab.com met GAME OVER instead of the homepage. On 2026-09-24 it
was turned into what it was always good at, which is a demo.

If you ever want real access control, see the last section. Do not revive
the allowlist.

### Rules that keep it safe

- **It never runs on its own.** No auto-start, no cover over the page, no
  delay before the site is readable. The only triggers are the footer
  button and `?scan=1`, or `?scan=refused` for the arcade ending.
- **Every screen is an overlay over an untouched page, and every screen
  has an exit.** The refusal screen carries a plain EXIT DEMO button, and
  Escape closes anything this file opens. An earlier version replaced
  `document.body.innerHTML`, which is fine for a gate that never intends
  to let you back in and useless for a demo. Do not go back to that.
- **Nothing is written to storage.** The lives and the guest pass live in
  memory for one run. There is no verdict worth remembering when there is
  no verdict.
- **Nothing is recorded or sent.** The device readout is read live in the
  tab. Two public lookups happen, `api64.ipify.org` for the address and
  `ipwho.is` for the rough location, and both are display only.

### The arcade ending

Three lives, spent one per refusal. With them gone the screen asks for a
magic word, shown as scrambled letter tiles because nobody can guess a word
they were never given. The word is `please`. Getting it right grants a five
minute guest pass with a countdown badge, which expires quietly. It is a
continue screen, not a login.

### Mobile constraints, learned the hard way

- The word input must never drop below 16px. Safari on iOS zooms the page
  in on a focused smaller input and does not zoom back out.
- The refusal screen is tall. Two height based tiers trim decoration under
  760px and under 620px, and the continue screen drops the trophy case on
  phones.
- The guest pass badge is positioned by script, not fixed offsets. It
  measures the header and drops below it rather than covering the menu
  button, which it did at phone width before.

### Removing it

```sh
sh scripts/remove-ip-gate.sh
```

Strips the marked blocks from every page and from `styles.css` and deletes
the script. It is one feature with one off switch. Everything it adds lives
either inside the markers or inside that file, so keep any new work there.

### If real access control is wanted later

It requires moving DNS for artivicolab.com off GoDaddy's default
nameservers onto Cloudflare, free tier is enough, then enforcing an
allowlist with a Cloudflare Worker or firewall rule at the edge, before
requests ever reach GitHub Pages. That is a real block, and unlike this
one it cannot be read or edited by the visitor. Not set up as of
2026-09-19 because it needs account level access, GoDaddy and Cloudflare,
that a coding session cannot perform on its own.
