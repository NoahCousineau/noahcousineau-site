#!/bin/bash
#
# DOUBLE-CLICK THIS FILE TO PUBLISH THE SITE.
#
# It opens a Terminal window, checks the site builds, and if it does, sends it
# live. If anything is wrong it stops and says so, and your live site is left
# exactly as it was.
#
# You can also drag this file to your Dock or Desktop and use it from there —
# a Mac shortcut keeps pointing at the original, so it will still work.

# Run from the folder this file lives in, no matter where it was launched from.
cd "$(dirname "$0")" || exit 1

clear
node tools/publish.mjs
STATUS=$?

echo
if [ $STATUS -eq 0 ]; then
  echo "Done. You can close this window."
else
  echo "Nothing was published. You can close this window."
fi
echo
# Hold the window open so the message is readable rather than flashing past.
read -r -p "Press Return to close. "
