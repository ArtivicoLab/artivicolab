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

**To remove it (tested, safe):**
```sh
sh scripts/remove-ip-gate.sh
```
This strips the marked blocks from every HTML page and from styles.css, and
deletes `assets/js/ip-gate.js`. Review with `git diff` before committing.

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
