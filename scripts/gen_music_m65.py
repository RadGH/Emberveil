#!/usr/bin/env python3
"""Generate 3 additional calmer combat music tracks via ElevenLabs Music API."""
import json, urllib.request, pathlib, time
KEY = pathlib.Path("/home/radgh/claude/assets/references/elevenlabs-api-key.txt").read_text().strip()
OUT = pathlib.Path("/home/radgh/claude/game13/public/music")
OUT.mkdir(parents=True, exist_ok=True)

TRACKS = [
    ("combat_calm_01", "Mellow epic fantasy battle march, 16-bit SNES chiptune, steady drum beat, subdued brass, not frantic, suitable for routine encounters, looping, bitcrunch", 60000),
    ("combat_calm_02", "Low-key mysterious dungeon combat theme, SNES 16-bit chiptune, slow pulsing bass, soft hi-hats, cautious heroic undertone, not loud or busy, looping, bitcrunch", 60000),
    ("combat_calm_03", "Moody minor-key fantasy skirmish theme, SNES 16-bit chiptune, walking bassline, restrained percussion, understated tension, epic but not hectic, looping, bitcrunch", 60000),
    ("boss_theme",     "Climactic boss fight music, 16-bit SNES chiptune, huge dramatic brass stabs, pounding war drums, frantic strings, heroic and intense, only for major bosses, looping, bitcrunch", 90000),
]

def gen(name, prompt, ms):
    out = OUT / f"{name}.mp3"
    if out.exists() and out.stat().st_size > 10000:
        print(f"skip {name}", flush=True); return
    body = json.dumps({"prompt": prompt, "music_length_ms": ms}).encode()
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/music",
        data=body,
        headers={"xi-api-key": KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            out.write_bytes(r.read())
        print(f"ok {name}", flush=True)
    except Exception as e:
        print(f"ERR {name}: {e}", flush=True)

for (n, p, ms) in TRACKS:
    gen(n, p, ms)
    time.sleep(1)
print("m65 music done")
