# CLAUDE.md

Notes for whoever (human or Claude) works on this repo next.

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

With the lives gone the screen becomes a continue prompt asking for the
magic word. A correct answer, case and trailing punctuation forgiven,
writes a five minute guest pass, resets the lives to three and reloads
into the real site. A countdown badge sits top right and turns red under
the final minute. On expiry it clears the pass and reloads, which puts
the visitor back on the block screen to start the grind again.

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
