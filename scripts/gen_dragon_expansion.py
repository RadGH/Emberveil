#!/usr/bin/env python3
"""Generate dragon expansion backgrounds (and fallback sprites) via OpenAI gpt-image-1."""
import json, base64, urllib.request, pathlib, time, sys
KEY = pathlib.Path("/home/radgh/claude/assets/references/openai-api-key.txt").read_text().strip()
OUT = pathlib.Path("/home/radgh/claude/game13/public/images/dragon_expansion")
OUT.mkdir(parents=True, exist_ok=True)

JOBS = [
    ("dragon_reach_bg.jpg", "1536x1024",
     "Dragon's Reach: volcanic dragon mountain range, red dragons circling, lava cracks, painterly digital art, atmospheric, no text no UI, wide cinematic"),
    ("dragon_throne_bg.jpg", "1536x1024",
     "Dragon Throne Room: massive dragon skull throne in obsidian hall, glowing runes, dragon banners, painterly digital art, atmospheric, no text no UI, wide cinematic"),
]

# Optional fallback targets — only generated if --fallback passed
FALLBACK = [
    ("dragon_sprite.png", "1024x1024",
     "Fierce red dragon, wings spread, fantasy RPG enemy, painterly digital art, centered subject on dark plain background, no text no UI"),
    ("dragon_knight_icon.png", "1024x1024",
     "Dragon knight hero in dragon-scale armor with horned helm, fantasy RPG portrait, painterly digital art, centered bust, dark plain background, no text no UI"),
]

def gen(name, size, prompt):
    out = OUT / name
    if out.exists() and out.stat().st_size > 10000:
        print(f"skip {name}", flush=True); return
    body = json.dumps({
        "model": "gpt-image-1",
        "prompt": prompt,
        "size": size,
        "quality": "medium",
        "n": 1,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            data = json.loads(r.read())
        b64 = data["data"][0]["b64_json"]
        out.write_bytes(base64.b64decode(b64))
        print(f"ok {name}", flush=True)
    except Exception as e:
        print(f"ERR {name}: {e}", flush=True)

targets = list(JOBS)
if "--fallback" in sys.argv:
    targets += FALLBACK
if "--only-fallback" in sys.argv:
    targets = list(FALLBACK)

for (n, s, p) in targets:
    gen(n, s, p)
    time.sleep(1)
print("dragon expansion done")
