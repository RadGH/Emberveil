#!/usr/bin/env python3
"""Generate 3 music tracks via ElevenLabs Music API."""
import json, urllib.request, pathlib, time
KEY = pathlib.Path("/home/radgh/claude/secrets/elevenlabs-api-key.txt").read_text().strip()
OUT = pathlib.Path("/home/radgh/claude/game13/public/music")
OUT.mkdir(parents=True, exist_ok=True)

TRACKS = [
    ("title_theme",  "Epic high-fantasy orchestral main-menu theme, SNES-style 16-bit chiptune arrangement, bitcrunch retro, heroic and mysterious, looping", 60000),
    ("combat_theme", "Intense SNES-style 16-bit RPG combat battle music, driving chiptune drums, heroic brass, looping, bitcrunch", 60000),
    ("town_theme",   "Peaceful medieval fantasy town theme, SNES 16-bit chiptune, warm flutes and strings, cozy and welcoming, looping", 60000),
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
print("music done")
