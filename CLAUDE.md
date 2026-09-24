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
the arcade refusal screen as the other ending if they want to see it.

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
