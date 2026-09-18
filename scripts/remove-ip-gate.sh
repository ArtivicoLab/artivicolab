#!/bin/sh
# Removes the temporary client-side IP gate from every page and stylesheet,
# and deletes its script file. Run from the repo root:
#   sh scripts/remove-ip-gate.sh
set -e
cd "$(dirname "$0")/.."

for f in *.html assets/css/styles.css; do
  perl -0pi -e "s/[ \t]*(<!--|\/\*) IP-GATE:START.*?IP-GATE:END( -->|\s*\*\/)\n//s" "$f"
done

rm -f assets/js/ip-gate.js

echo "IP gate removed from all pages and styles.css. assets/js/ip-gate.js deleted."
echo "Review with: git diff"
