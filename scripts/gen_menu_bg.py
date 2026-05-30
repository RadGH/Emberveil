#!/usr/bin/env python3
"""Generate pixel-art main menu backgrounds + cloud layers via OpenAI."""
import json, base64, urllib.request, pathlib, time
KEY = pathlib.Path("/home/radgh/claude/secrets/openai-api-key.txt").read_text().strip()
OUT = pathlib.Path("/home/radgh/claude/game13/public/images/menu_bg")
OUT.mkdir(parents=True, exist_ok=True)

ITEMS = [
    ("menu_wide",    "1536x1024", "Pixel art high-fantasy mountain landscape at dusk with distant castle silhouette, twilight gold and ember palette, no text no UI, 16-bit SNES RPG style"),
    ("menu_square",  "1024x1024", "Pixel art high-fantasy mountain landscape at dusk with distant castle silhouette, twilight gold and ember palette, no text no UI, 16-bit SNES RPG style, square composition"),
    ("clouds_01",    "1536x1024", "Pixel art drifting clouds on transparent/dark sky, soft golden edges, SNES 16-bit style, no text no UI, wispy horizontal"),
    ("clouds_02",    "1536x1024", "Pixel art drifting stratus clouds, warmer orange tones, SNES 16-bit style, no text no UI, wispy horizontal"),
    ("clouds_03",    "1536x1024", "Pixel art drifting cumulus clouds, darker dramatic tones, SNES 16-bit style, no text no UI, wispy horizontal"),
]

def gen(name, size, prompt):
    out = OUT / f"{name}.png"
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
        with urllib.request.urlopen(req, timeout=300) as r:
            data = json.loads(r.read())
        out.write_bytes(base64.b64decode(data["data"][0]["b64_json"]))
        print(f"ok {name}", flush=True)
    except Exception as e:
        print(f"ERR {name}: {e}", flush=True)

for (n, s, p) in ITEMS:
    gen(n, s, p)
    time.sleep(1)
print("menu bg done")
