#!/usr/bin/env python3
"""Generate 16:9 environmental map backgrounds via OpenAI gpt-image-1."""
import json, base64, urllib.request, pathlib, time
KEY = pathlib.Path("/home/radgh/claude/secrets/openai-api-key.txt").read_text().strip()
OUT = pathlib.Path("/home/radgh/claude/game13/public/images/map_bg")
OUT.mkdir(parents=True, exist_ok=True)

# (filename, environment prompt) — one per zone
MAPS = [
    ("border_roads",    "Dusty medieval trade road at dusk, rolling hills, distant mountains, twilight orange sky, painterly digital art, atmospheric, no text no UI, wide cinematic"),
    ("thornwood",       "Dense dark ancient thornwood forest with gnarled trees, mossy ground, dappled eerie light, painterly digital art, atmospheric, no text no UI, wide cinematic"),
    ("dust_roads",      "Sunbleached desert dust road with mesas and cracked earth, dusty haze, warm orange palette, painterly digital art, atmospheric, no text no UI, wide cinematic"),
    ("ember_plateau",   "Volcanic plateau with glowing lava cracks, obsidian rocks, red sky, ember particles, painterly digital art, atmospheric, no text no UI, wide cinematic"),
    ("hell_breach",     "Demonic hellish breach with brimstone spires, red lightning, bone piles, dark dramatic sky, painterly digital art, atmospheric, no text no UI, wide cinematic"),
    ("shattered_core",  "Shattered cosmic core with floating broken land, purple void sky, glowing rifts, painterly digital art, atmospheric, no text no UI, wide cinematic"),
    ("cosmic_rift",     "Vast cosmic rift with nebula swirls, stars, floating asteroids, deep blue and violet palette, painterly digital art, atmospheric, no text no UI, wide cinematic"),
    ("eternal_void",    "Eternal void with dim distant stars, endless black space, faint aurora, painterly digital art, atmospheric, no text no UI, wide cinematic"),
    ("abyssal_depths",  "Deep ocean abyssal trench with bioluminescent creatures, dark water, ancient ruins below, painterly digital art, atmospheric, no text no UI, wide cinematic"),
    ("primordial_nexus", "Primordial creation nexus with swirling chaotic energies, proto-matter clouds, impossible geometry, painterly digital art, atmospheric, no text no UI, wide cinematic"),
]

def gen(name, prompt):
    out = OUT / f"{name}.jpg"
    if out.exists() and out.stat().st_size > 10000:
        print(f"skip {name}", flush=True); return
    body = json.dumps({
        "model": "gpt-image-1",
        "prompt": prompt,
        "size": "1536x1024",
        "quality": "medium",
        "n": 1,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = json.loads(r.read())
        b64 = data["data"][0]["b64_json"]
        out.write_bytes(base64.b64decode(b64))
        print(f"ok {name}", flush=True)
    except Exception as e:
        print(f"ERR {name}: {e}", flush=True)

for (n, p) in MAPS:
    gen(n, p)
    time.sleep(1)
print("map bg done")
