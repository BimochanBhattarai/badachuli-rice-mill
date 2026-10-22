#!/bin/bash
# Restores v1_2026-09-17_initial.db to the Badachuli Rice Mill database on macOS.
# Close the app before running this, then restart it afterward.

SCRIPT_DIR=$(dirname "$0")
SNAPSHOT="$SCRIPT_DIR/v1_2026-09-17_initial.db"
TARGET="$HOME/Library/Application Support/Badachuli Rice Mill/badachuli.db"
TARGET_DIR="$HOME/Library/Application Support/Badachuli Rice Mill"

mkdir -p "$TARGET_DIR"
echo "Restoring database from v1_2026-09-17_initial.db ..."
cp "$SNAPSHOT" "$TARGET"
echo "Done! Restart the Badachuli Rice Mill app."
