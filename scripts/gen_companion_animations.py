#!/usr/bin/env python3
"""Generate walk/attack animation frames for the 10 new companion sprites via OpenAI."""
import json, base64, urllib.request, pathlib, time
KEY = pathlib.Path("/home/radgh/claude/secrets/openai-api-key.txt").read_text().strip()
OUT = pathlib.Path("/home/radgh/claude/game13/public/images/sprites")
OUT.mkdir(parents=True, exist_ok=True)

COMPANIONS = [
    ("dire_wolf", "large dire wolf", "grey fur, fierce eyes, powerful stance"),
    ("forest_owl", "mystical brown forest owl", "wings spread, wise expression"),
    ("ember_drake", "small red ember drake dragon", "tiny wings, glowing ember breath, scales"),
    ("shadow_cat", "sleek black shadow cat", "purple glowing eyes, wispy shadow tail"),
    ("crystal_golem", "small crystal golem", "blue crystal limbs, glowing core"),
    ("spirit_wisp", "floating blue-white spirit wisp", "ethereal glow, tiny face, floating"),
    ("bone_hound", "skeletal bone hound", "greenish necromantic glow, exposed bones"),
    ("ice_sprite", "small cyan ice sprite", "icicle wings, crystalline form"),
    ("swamp_frog", "large mossy swamp frog", "warts, dripping slime, bulging eyes"),
    ("void_moth", "large void moth", "purple starry wings, cosmic pattern"),
]

def gen(name, desc, features, variant):
    """Generate animation frame for a companion."""
    suffix = "_walk" if variant == "walk" else "_attack"
    out = OUT / f"{name}_south{suffix}.png"

    if out.exists() and out.stat().st_size > 10000:
        print(f"skip {name}{suffix}", flush=True)
        return

    # Create prompts for walk vs attack animations
    if variant == "walk":
        action_desc = "mid-stride walking animation frame, one paw/leg raised, dynamic movement pose"
    else:  # attack
        action_desc = "attacking pose, aggressive stance, lunging forward or preparing to strike"

    prompt = f"16-bit SNES RPG pixel art of a {desc} facing south, {features}, {action_desc}, transparent background, game-ready sprite"

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
        print(f"ok {name}{suffix}", flush=True)
    except Exception as e:
        print(f"ERR {name}{suffix}: {e}", flush=True)

# Generate walk and attack frames for each companion
for name, desc, features in COMPANIONS:
    gen(name, desc, features, "walk")
    time.sleep(1)
    gen(name, desc, features, "attack")
    time.sleep(1)

print("companion animations done")