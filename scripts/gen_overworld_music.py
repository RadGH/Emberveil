#!/usr/bin/env python3
"""M69: Generate 6 overworld music tracks + regenerate calmer combat/boss themes."""
import json, urllib.request, pathlib, time, sys

KEY = pathlib.Path("/home/radgh/claude/assets/references/elevenlabs-api-key.txt").read_text().strip()
OUT = pathlib.Path("/home/radgh/claude/game13/public/music")
OUT.mkdir(parents=True, exist_ok=True)

LEN = 90000  # 90s overworld
COMBAT_LEN = 60000

TRACKS = [
    ("overworld_act1", "Calm fantasy RPG overworld exploration music. Lighthearted medieval lute and harp, gentle pastoral strings, hopeful and serene, instrumental, no vocals, looping ambient.", LEN),
    ("overworld_act2", "Calm fantasy RPG desert overworld music in Aladdin / Middle-Eastern style. Oud, duduk, hand drums, exotic Phrygian/Hijaz modes, calm wandering, instrumental, no vocals, looping ambient.", LEN),
    ("overworld_act3", "Calm fantasy RPG mystical highlands overworld music. Pan flute, Celtic fiddle, soft bodhran, foggy and reflective Scottish/Irish atmosphere, instrumental, no vocals, looping ambient.", LEN),
    ("overworld_act4", "Calm fantasy RPG dark forest overworld music. Ominous low strings, distant horn, light percussion, cautious unease, instrumental, no vocals, looping ambient.", LEN),
    ("overworld_act5", "Calm fantasy RPG ethereal cosmic overworld music. Shimmering pads, glass bells, soft choir oohs, otherworldly drifting, instrumental, no vocals, looping ambient.", LEN),
    ("overworld_act6", "Calm fantasy RPG dragon volcanic overworld music. Low taiko drums, distant brass swells, ember-crackle ambience, smouldering majesty, instrumental, no vocals, looping ambient.", LEN),
    ("combat_theme",   "Calm but tense fantasy RPG combat music, mid-tempo, light percussion, restrained strings, focused not frantic, instrumental, looping.", COMBAT_LEN),
    ("boss_theme",     "Dramatic but restrained fantasy RPG boss music, slow building tension, deep strings and timpani, ominous but not chaotic, instrumental, looping.", COMBAT_LEN),
]

def gen(name, prompt, ms, retry=True):
    out = OUT / f"{name}.mp3"
    body = json.dumps({"prompt": prompt, "music_length_ms": ms}).encode()
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/music",
        data=body,
        headers={"xi-api-key": KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    try:
        with urllib.request.urlopen(req, timeout=900) as r:
            data = r.read()
        out.write_bytes(data)
        print(f"OK {name} {len(data)} bytes", flush=True)
        return True
    except Exception as e:
        print(f"ERR {name}: {e}", flush=True)
        if retry:
            time.sleep(5)
            print(f"RETRY {name}", flush=True)
            return gen(name, prompt, ms, retry=False)
        return False

results = {}
for (n, p, ms) in TRACKS:
    results[n] = gen(n, p, ms)
    time.sleep(2)

print("\n=== SUMMARY ===")
for n, ok in results.items():
    print(f"  {'OK' if ok else 'FAIL'} {n}")
print("done")
