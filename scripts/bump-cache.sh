#!/bin/sh
# Bumps the ?v= cache-buster on our own asset links so browsers fetch the
# new CSS and JS after a deploy instead of serving stale copies. Runs from
# the pre-commit hook, or by hand:
#   sh scripts/bump-cache.sh
#
# The value is derived from the clock only because that is a convenient way
# to get a always-increasing string. It is never shown to anyone. The site
# used to print a "Site updated" date in the footer and in the entry
# notice; both were removed on 2026-09-25 and should not come back.
set -e
cd "$(dirname "$0")/.."
VER="$(TZ=America/Denver date '+%Y%m%d-%H%M')"
for f in *.html; do
  perl -pi -e "s/(assets\/(?:css|js)\/[A-Za-z0-9_.-]+)\?v=[0-9-]+/\${1}?v=$VER/g" "$f"
done
echo "asset cache-buster -> ?v=$VER"
