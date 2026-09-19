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

Shown only at 1180px and wider, where the gutters exist. Measured clear of
the 1100px container at every width above that.

## ⚠️ Temporary: client-side IP gate, remove by 2026-09-20

Added 2026-09-18 at the user's request, to visually hide the site from
everyone except two specific IP addresses.

**This is not real access control, and nothing in it ever became real
access control.** The site is static, hosted on GitHub Pages, with no
server or edge layer able to check a visitor before serving files. The
gate only hides content in browsers that run `assets/js/ip-gate.js`.
Anything that does not execute JavaScript still gets the real page: curl,
bots, search engines, a reader with JS disabled, or plain view-source.

Two specific bypasses are worth knowing, because both are one line of
work for a visitor:

- The verdict cache is trusted exactly as found. Setting
  `artivicolab_ipgate_v1` to `{"allowed":true,"at":<now>}` in the console
  grants entry with no VPN and no scan.
- The magic word on the block screen is `please`, sitting in the source
  where anyone can read it.

Do not describe this gate to anyone as protection. It is a stage set.

### Where it lives

Everything the gate adds is in one of exactly two places. This is what
makes removal safe, so keep any future gate work inside these lines.

- `assets/js/ip-gate.js`, the whole thing: allowlist, address lookup,
  scan sequence, block screen, arcade loop, guest pass. The removal
  script deletes this file outright.
- Marker blocks, stripped by the removal script:
  - every `*.html` page, two lines wrapped in `<!-- IP-GATE:START -->`
    and `<!-- IP-GATE:END -->`, just after the charset meta tag.
  - `assets/css/styles.css`, one block wrapped in `/* IP-GATE:START */`
    and `/* IP-GATE:END */`, holding the pre-paint cover, the scan
    overlay, the dossier, the specimen plate, the block screen, the
    magic word prompt and the guest pass badge.

The rescan button in the footer is injected at runtime next to
`#beatsBtn`, so it leaves with the script. No page markup references it.

### What the visitor sees

The scan runs for 30 seconds as three timed steps, one on screen at a
time, with a large radar watermark behind all of them. Step one acquires
the address, step two sweeps the device, step three classifies the
visitor as *Homo staticus* on a specimen plate credited to Gradi Kayamba
as curator. A fixed header carries the step name and countdown, a fixed
footer carries the status line, progress bar and note.

The device readout is all values the browser volunteers. None of it is
stored or transmitted by the site, and the fine print on step three says
so.

### Outbound requests

Two third party calls, both from the visitor's browser:

- `api64.ipify.org`, returns the address. The allow or deny decision
  rests on this alone.
- `ipwho.is`, returns city, region, country, provider and coordinates for
  the readout only. Display only by design, so a slow or failed lookup
  leaves those rows unresolved and changes no decision.

### The arcade loop on the block screen

A denied visitor gets three lives, drawn as hearts on the player card.
Each fresh denial spends one. Loads served from the one hour verdict
cache do not spend one, or ordinary browsing would drain them.

With the lives gone the screen becomes a continue prompt. Nobody can guess
a word they were never shown, so the letters go up scrambled on tiles and
the visitor unscrambles them. The scramble is reshuffled per load and
never shows the answer in order. A correct answer, case and surrounding
punctuation forgiven, writes a five minute guest pass, resets the lives to
three and reloads into the real site. A countdown badge sits top right and turns red under
the final minute. On expiry it clears the pass and reloads, which puts
the visitor back on the block screen to start the grind again.

### Mobile constraints, learned the hard way

Two things that are easy to break again:

- The word input must never be set below 16px. Safari on iOS zooms the
  page in when a focused input is smaller, and it does not zoom back out
  afterwards, which strands the visitor zoomed in on a granted page.
- The guest pass badge is positioned by script, not by fixed CSS offsets.
  It measures the header and drops below it whenever it would cover the
  hamburger, the nav links or the logo. A fixed top right corner covered
  the menu button outright on phones. Keep the measuring, or the menu
  becomes unreachable for anyone holding a pass.
- The block screen has to fit without scrolling, and the arcade cabinet is
  too tall for short phones. Two height based media queries trim it: under
  760px tall the user agent string and the insert coin line go, and under
  620px tall the fake firewall bar goes too. The continue screen drops the
  trophy case entirely on phones so the prompt, the tiles and the keyboard
  share one screen. Measured as fitting at 390x844, 360x640 and 320x568,
  in both the denial and the continue states.

### localStorage keys

- `artivicolab_ipgate_v1`, the cached allow or deny verdict, one hour.
- `artivicolab_ipgate_lives_v1`, lives remaining.
- `artivicolab_ipgate_pass_v1`, guest pass expiry.

Removing the gate leaves these behind in visitors' browsers, where
nothing reads them and they cost a few bytes. Harmless, not worth a
migration.

### To remove it

```sh
sh scripts/remove-ip-gate.sh
```

This strips the marked blocks from every HTML page and from styles.css,
and deletes `assets/js/ip-gate.js`. Review with `git diff` before
committing.

Removing the gate removes all of it at once. The scan, the dossier, the
specimen plate, the denied screen, the lives, the magic word and the
guest pass are one feature with one off switch, not separate pieces to
unpick.

Verified on 2026-09-19 against a throwaway copy of the repo. After
running the script, no reference to the gate, the scan, the block screen
or the arcade loop survives in any page, in styles.css, or anywhere else,
and the site renders normally with the entry notice and canvas design
untouched.

**If nobody has removed it by 2026-09-20**, whoever picks this up next
should run the script above, commit, and push. The gate was only ever
meant to be temporary.

### If real access control is wanted later

It requires moving DNS for artivicolab.com off GoDaddy's default
nameservers onto Cloudflare, free tier is enough, then enforcing an
allowlist with a Cloudflare Worker or firewall rule at the edge, before
requests ever reach GitHub Pages. That is a real block, and unlike this
one it cannot be read or edited by the visitor. Not set up as of
2026-09-19 because it needs account level access, GoDaddy and Cloudflare,
that a coding session cannot perform on its own.
