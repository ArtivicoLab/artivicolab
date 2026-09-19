# CLAUDE.md

Notes for whoever (human or Claude) works on this repo next.

## ⚠️ Temporary: client-side IP gate — remove by 2026-09-20

Added 2026-09-18 at the user's request, to visually hide the site from
everyone except two specific IPs. **This is not real access control.** The
site is static, hosted on GitHub Pages, with no server or edge layer able to
check a visitor's IP before serving files. The gate only hides content in
browsers that execute `assets/js/ip-gate.js`. Anything that doesn't run
JavaScript (curl, bots, search engines, disabled JS, view-source) still gets
the real page. It fails closed: if the IP lookup can't be verified, the page
is blocked rather than shown.

**Where it lives:**
- `assets/js/ip-gate.js` — the allowlist and the fetch/compare/ban logic.
- Every `*.html` page — two lines wrapped in `<!-- IP-GATE:START -->` /
  `<!-- IP-GATE:END -->` markers, right after the charset meta tag.
- `assets/css/styles.css` — one block wrapped in `/* IP-GATE:START */` /
  `/* IP-GATE:END */` markers, styles the pre-paint cover and the banned
  screen.

**The arcade loop on the block screen:** a denied visitor gets three lives.
Each fresh denial spends one. Loads served from the one hour verdict cache
do not spend a life, or ordinary browsing would drain them. With no lives
left the screen asks for a magic word, which is `please`, and a correct
answer writes a five minute guest pass, resets the lives and reloads. A
countdown badge shows the time left, and on expiry the page reloads and
the visitor is blocked again. The word is in the source, so this is a toy,
not a login.

**localStorage keys it writes** (all removable, all harmless if orphaned):
`artivicolab_ipgate_v1` for the cached verdict, `artivicolab_ipgate_lives_v1`
for the remaining lives, `artivicolab_ipgate_pass_v1` for the guest pass.
Deleting the script leaves these behind in visitors' browsers, where nothing
reads them and they take up a few bytes.

**To remove it (tested, safe):**
```sh
sh scripts/remove-ip-gate.sh
```
This strips the marked blocks from every HTML page and from styles.css, and
deletes `assets/js/ip-gate.js`. Review with `git diff` before committing.

Verified on 2026-09-19 against a throwaway copy of the repo: after running
it, no reference to the gate, the scan, the block screen or the arcade loop
survives in any page, in styles.css, or anywhere else, and the site renders
normally. Everything the gate adds lives either inside the marker comments
or inside `ip-gate.js`, which the script deletes outright. Keep it that way:
any new gate code belongs in one of those two places and nowhere else.

**If nobody has removed it by 2026-09-20**, whoever picks this up next
should run the script above, commit, and push. The gate was only ever meant
to be temporary.

**If real IP-based access control is wanted later:** it requires moving DNS
for artivicolab.com off GoDaddy's default nameservers onto Cloudflare (free
tier), then enforcing an allowlist with a Cloudflare Worker or Firewall
rule at the edge, before requests ever reach GitHub Pages. That's a real,
non-bypassable block, unlike this one. Not set up as of 2026-09-18 because
it needs account-level access (GoDaddy + Cloudflare) that a coding session
can't perform on its own.
