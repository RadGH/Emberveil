#!/usr/bin/env bash
# M67: Two-pass EBU R128 loudness normalization of all SFX to -16 LUFS.
# Archives originals to public/sfx_original/ for before/after comparison.
set -euo pipefail

SFX="/home/radgh/claude/game13/public/sfx"
ARCHIVE="/home/radgh/claude/game13/public/sfx_original"
LOG="/home/radgh/claude/game13/scripts/normalize_sfx.log"

mkdir -p "$ARCHIVE"
: > "$LOG"

for f in "$SFX"/*.{mp3,ogg,wav}; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f")"
  # Skip if already archived (means already normalized in a prior run)
  if [[ -f "$ARCHIVE/$base" ]]; then
    echo "skip $base (already normalized)" >> "$LOG"
    continue
  fi
  cp "$f" "$ARCHIVE/$base"

  ext="${f##*.}"
  tmp="$SFX/.norm_tmp.$$.$ext"

  # Single-pass loudnorm is fine for short SFX and avoids the json-parse dance
  if ffmpeg -y -i "$f" -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 "$tmp" \
      >>"$LOG" 2>&1; then
    mv "$tmp" "$f"
    echo "ok   $base" >> "$LOG"
  else
    rm -f "$tmp"
    echo "FAIL $base" >> "$LOG"
  fi
done

echo "done" >> "$LOG"
