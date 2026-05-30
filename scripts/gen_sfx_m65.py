#!/usr/bin/env python3
"""Generate M65 replacement/additional combat SFX via ElevenLabs Sound Generation API.
Short, punchy, clang/boom style — not beeps."""
import json, urllib.request, pathlib, time
KEY = pathlib.Path("/home/radgh/claude/assets/references/elevenlabs-api-key.txt").read_text().strip()
OUT = pathlib.Path("/home/radgh/claude/game13/public/sfx")
OUT.mkdir(parents=True, exist_ok=True)

# (name, prompt, duration_seconds) — short & crunchy, 16-bit SNES flavor
SFX = [
    # Melee hits — replace default boops
    ("melee_hit_light",   "Short punchy metallic sword slash clang, 16-bit SNES RPG battle hit sound, crunchy, 0.3 seconds", 0.4),
    ("melee_hit_heavy",   "Heavy dull thud of warhammer impact on armor, crunchy bass boom, 16-bit SNES RPG style, 0.4 seconds", 0.5),
    ("melee_slash",       "Sharp quick blade slash through air and flesh, short, 16-bit SNES RPG battle sound, crunchy", 0.35),
    ("melee_crit",        "Big satisfying critical hit clang-boom, metallic impact with echo, short, 16-bit SNES RPG", 0.55),
    ("melee_miss",        "Quick whoosh of missed attack cutting air, 16-bit SNES RPG, very short", 0.3),
    ("arrow_shoot",       "Quick bowstring twang and arrow release, short, 16-bit SNES RPG", 0.35),
    ("arrow_hit",         "Arrow thunk into wood or flesh, short dull impact, 16-bit SNES RPG", 0.35),
    ("punch",             "Blunt fist impact thud, short, 16-bit SNES RPG", 0.3),
    ("axe_chop",          "Heavy axe chop cleaving impact, short, 16-bit SNES RPG", 0.4),
    ("dagger_stab",       "Quick sharp dagger stab puncture, very short, 16-bit SNES RPG", 0.3),
    ("shield_block",      "Metal shield block clang with slight ring, short, 16-bit SNES RPG", 0.45),
    ("parry",             "Metal-on-metal parry with quick scrape, short, 16-bit SNES RPG", 0.35),
    # Spells
    ("spell_fire",        "Whooshing fire spell cast with ignite boom, short, 16-bit SNES RPG", 0.55),
    ("spell_ice",         "Crystalline ice spell freeze shimmer, short, 16-bit SNES RPG", 0.5),
    ("spell_lightning",   "Crackling lightning bolt zap with thunder clap, short, 16-bit SNES RPG", 0.55),
    ("spell_holy",        "Radiant holy magic chime burst, short, 16-bit SNES RPG", 0.5),
    ("spell_dark",        "Ominous dark magic whisper and impact, short, 16-bit SNES RPG", 0.5),
    ("spell_heal",        "Warm healing chime with gentle sparkle ascension, short, 16-bit SNES RPG", 0.55),
    ("spell_buff",        "Soft ascending magic shimmer buff cast, short, 16-bit SNES RPG", 0.45),
    ("spell_debuff",      "Descending distorted magical curse hiss, short, 16-bit SNES RPG", 0.45),
    ("spell_explode",     "Big magical explosion boom with crunch, short, 16-bit SNES RPG", 0.6),
    # Reactions
    ("enemy_death",       "Monster death groan with falling thud, short, 16-bit SNES RPG", 0.6),
    ("enemy_growl",       "Short angry monster growl, 16-bit SNES RPG", 0.4),
    ("hero_hurt",         "Male warrior pained grunt, very short, 16-bit SNES RPG", 0.3),
    ("hero_hurt_f",       "Female warrior pained grunt, very short, 16-bit SNES RPG", 0.3),
    ("hero_death",        "Male warrior death cry fade, short, 16-bit SNES RPG", 0.7),
    ("crit_cue",          "Satisfying critical stinger cue, very short, 16-bit SNES RPG", 0.35),
    # Potions / items
    ("potion_drink",      "Quick glass pop and bubbly liquid gulp, very short, 16-bit SNES RPG", 0.4),
    ("potion_heal_cue",   "Bright positive heal chime after drinking potion, very short, 16-bit SNES RPG", 0.4),
]

def gen(name, prompt, dur):
    out = OUT / f"{name}.mp3"
    if out.exists() and out.stat().st_size > 5000:
        print(f"skip {name}", flush=True); return
    body = json.dumps({"text": prompt, "duration_seconds": dur}).encode()
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/sound-generation",
        data=body,
        headers={"xi-api-key": KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            out.write_bytes(r.read())
        print(f"ok {name}", flush=True)
    except Exception as e:
        print(f"ERR {name}: {e}", flush=True)

for (n, p, d) in SFX:
    gen(n, p, d)
    time.sleep(0.3)
print("m65 sfx done")
