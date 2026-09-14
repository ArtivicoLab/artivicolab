#!/bin/sh
# Rewrites the "Site updated" stamp in assets/js/gate.js with the current
# Mountain Time and bumps the ?v= cache-buster on our own asset links so
# browsers fetch the new files. Runs from the pre-commit hook, or by hand:
#   sh scripts/update-stamp.sh
set -e
cd "$(dirname "$0")/.."
STAMP="$(TZ=America/Denver date '+%B %-d, %Y · %-I:%M %p %Z')"
VER="$(TZ=America/Denver date '+%Y%m%d-%H%M')"
DATE="$(TZ=America/Denver date '+%B %-d, %Y')"
perl -0pi -e "s/(Site updated &middot; )[^<]*/\${1}$STAMP/" assets/js/gate.js
for f in *.html; do
  perl -pi -e "s/(assets\/(?:css|js)\/[A-Za-z0-9_.-]+)\?v=[0-9-]+/\${1}?v=$VER/g" "$f"
  perl -pi -e "s/(<span class=\"site-stamp\">Updated )[^<]*/\${1}$DATE/" "$f"
done
echo "Site updated stamp -> $STAMP  (assets ?v=$VER)"
