#!/usr/bin/env python3
"""Generate 10 companion sprites via OpenAI gpt-image-1 in pixel-art style."""
import json, base64, urllib.request, pathlib, time
KEY = pathlib.Path("/home/radgh/claude/secrets/openai-api-key.txt").read_text().strip()
OUT = pathlib.Path("/home/radgh/claude/game13/public/images/sprites")
OUT.mkdir(parents=True, exist_ok=True)

COMPANIONS = [
    ("dire_wolf",    "16-bit SNES RPG pixel art of a large dire wolf facing south, grey fur, fierce eyes, transparent background, game-ready sprite, 4-frame idle stance"),
    ("forest_owl",   "16-bit SNES RPG pixel art of a mystical brown forest owl facing south, wings slightly spread, transparent background, game-ready sprite"),
    ("ember_drake",  "16-bit SNES RPG pixel art of a small red ember drake dragon facing south, tiny wings, glowing ember breath, transparent background, game-ready sprite"),
    ("shadow_cat",   "16-bit SNES RPG pixel art of a sleek black shadow cat facing south, purple glowing eyes, wispy shadow tail, transparent background, game-ready sprite"),
    ("crystal_golem","16-bit SNES RPG pixel art of a small crystal golem facing south, blue crystal limbs, glowing core, transparent background, game-ready sprite"),
    ("spirit_wisp",  "16-bit SNES RPG pixel art of a floating blue-white spirit wisp, ethereal glow, tiny face, transparent background, game-ready sprite"),
    ("bone_hound",   "16-bit SNES RPG pixel art of a skeletal bone hound facing south, greenish necromantic glow, transparent background, game-ready sprite"),
    ("ice_sprite",   "16-bit SNES RPG pixel art of a small cyan ice sprite, icicle wings, crystalline form, transparent background, game-ready sprite"),
    ("swamp_frog",   "16-bit SNES RPG pixel art of a large mossy swamp frog facing south, warts, dripping slime, transparent background, game-ready sprite"),
    ("void_moth",    "16-bit SNES RPG pixel art of a large void moth with purple starry wings, cosmic pattern, transparent background, game-ready sprite"),
]

def gen(name, prompt):
    out = OUT / f"{name}_south.png"
    if out.exists() and out.stat().st_size > 10000:
        print(f"skip {name}", flush=True); return
    body = json.dumps({
        "model": "gpt-image-1",
        "prompt": prompt,
        "size": "1024x1024",
        "quality": "medium",
        "n": 1,
        "background": "transparent",
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = json.loads(r.read())
        out.write_bytes(base64.b64decode(data["data"][0]["b64_json"]))
        print(f"ok {name}", flush=True)
    except Exception as e:
        print(f"ERR {name}: {e}", flush=True)

for (n, p) in COMPANIONS:
    gen(n, p)
    time.sleep(1)
print("companions done")
