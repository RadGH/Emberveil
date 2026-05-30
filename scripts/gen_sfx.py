#!/usr/bin/env python3
"""Batch generate SFX via ElevenLabs Sound Generation API."""
import os, sys, json, time, urllib.request, urllib.error, pathlib

KEY = pathlib.Path("/home/radgh/claude/secrets/elevenlabs-api-key.txt").read_text().strip()
OUT = pathlib.Path("/home/radgh/claude/game13/public/sfx")
OUT.mkdir(parents=True, exist_ok=True)

# name, prompt, duration_seconds
SFX = [
    # --- Combat melee ---
    ("hit_sword",       "SNES-style sword slash and metal clang, crunchy 16-bit impact", 0.6),
    ("hit_blunt",       "retro 16-bit blunt mace thud with wooden crunch", 0.6),
    ("hit_dagger",      "quick bitcrunch dagger slice, sharp and short", 0.4),
    ("hit_arrow",       "SNES-style arrow whoosh and thunk into wood", 0.5),
    ("crit_slash",      "retro RPG critical hit — sharp slash, metallic ring, 16-bit crunch", 0.8),
    ("miss_whoosh",     "short whoosh of a weapon missing, 8-bit style", 0.3),
    ("block_shield",    "shield block clang, SNES-style metallic reverb", 0.5),
    ("parry",           "quick metallic parry ting, 16-bit chiptune impact", 0.4),
    ("dodge",           "short chiptune woosh dodge, retro game style", 0.3),
    ("enemy_hit",       "enemy grunt hit, bitcrunch 8-bit damage sound", 0.4),
    ("enemy_die",       "retro enemy defeat descending tones, SNES style", 1.0),
    ("boss_roar",       "low deep boss roar with bitcrunch distortion, 16-bit menacing", 1.5),
    # --- Spells ---
    ("spell_fire",      "SNES-style fire spell whoosh and crackle, chiptune 16-bit", 1.0),
    ("spell_ice",       "retro ice spell sparkle shatter, crystalline chiptune", 1.0),
    ("spell_lightning", "SNES lightning zap crack, electric bitcrunch", 0.8),
    ("spell_holy",      "chiptune holy light chime, ascending retro arpeggio", 1.2),
    ("spell_shadow",    "dark shadowy spell whoosh, eerie 16-bit chime", 1.0),
    ("spell_heal",      "soft healing chime, warm retro arpeggio", 1.0),
    ("spell_buff",      "empowering buff shimmer, rising chiptune tone", 0.8),
    ("spell_debuff",    "descending debuff drone, retro game style", 0.8),
    ("spell_summon",    "magical summoning swell with bitcrunch sparkle, SNES style", 1.2),
    ("spell_arcane",    "arcane burst, crystalline chiptune sparkle", 0.9),
    # --- UI ---
    ("ui_click",        "short 8-bit UI click blip", 0.15),
    ("ui_confirm",      "two-tone chiptune confirm ding", 0.3),
    ("ui_cancel",       "descending chiptune cancel blip", 0.3),
    ("ui_open_menu",    "short menu open chime, SNES style", 0.3),
    ("ui_close_menu",   "short menu close chime, SNES style", 0.3),
    ("ui_hover",        "very soft 8-bit hover blip", 0.1),
    ("ui_error",        "low chiptune error buzz", 0.3),
    # --- Rewards / progression ---
    ("coin_pickup",     "retro coin pickup chime, SNES style", 0.4),
    ("gold_gain",       "jingly gold reward sparkle, 16-bit retro", 0.8),
    ("item_pickup",     "short chiptune item get blip, retro game", 0.5),
    ("item_equip",      "soft equipment fasten click, 16-bit", 0.3),
    ("level_up",        "triumphant chiptune level up fanfare, SNES style", 2.0),
    ("quest_complete",  "retro quest complete flourish, 16-bit uplifting", 1.8),
    ("unlock",          "chiptune unlock sparkle, ascending", 0.8),
    ("victory_fanfare", "short victory trumpet fanfare, SNES 16-bit", 2.5),
    ("defeat",          "sad descending chiptune defeat jingle, retro", 2.0),
    # --- Environment / events ---
    ("footstep_stone",  "single 8-bit footstep on stone", 0.2),
    ("footstep_dirt",   "single retro footstep on dirt", 0.2),
    ("door_open",       "wooden door creak open, bitcrunch", 0.6),
    ("door_close",      "wooden door slam, retro", 0.4),
    ("chest_open",      "wooden chest creak open with chime, SNES style", 1.0),
    ("torch_lit",       "retro torch ignite whoosh, chiptune", 0.5),
    ("trap_spring",     "chiptune trap spring click and twang, 8-bit", 0.5),
    ("portal_warp",     "warp portal whoosh, ascending chiptune shimmer", 1.5),
    ("shrine_pray",     "holy shrine hum, sustained chiptune tone", 1.5),
    ("rest_heal",       "gentle sleeping rest chime, soft retro", 1.2),
    # --- Companions / animals ---
    ("bark",            "short dog bark, bitcrunch 8-bit", 0.3),
    ("wolf_howl",       "wolf howl, retro chiptune", 1.2),
    ("owl_hoot",        "owl hoot, short chiptune", 0.5),
    ("cat_meow",        "short cat meow, 8-bit style", 0.3),
    ("drake_screech",   "small drake screech, bitcrunch", 0.6),
    ("sprite_chime",    "tiny sprite chime, crystalline chiptune", 0.4),
    # --- Ambient / world ---
    ("wind_gust",       "short wind gust whoosh, retro", 0.8),
    ("fire_crackle",    "crackling fire loop, bitcrunch 8-bit", 2.0),
    ("water_drip",      "single retro water drip ping", 0.3),
    ("thunder_rumble",  "low thunder rumble, distant chiptune", 1.5),
    # --- Status ---
    ("status_poison",   "bubbling poison fizz, retro chiptune", 0.6),
    ("status_burn",     "burning sizzle, chiptune bitcrunch", 0.6),
    ("status_stun",     "dizzy stun wobble, chiptune descending warble", 0.8),
    ("status_freeze",   "icy freeze crack, short chiptune", 0.5),
]

def gen(name, prompt, dur):
    out_path = OUT / f"{name}.mp3"
    if out_path.exists() and out_path.stat().st_size > 1000:
        print(f"skip {name}", flush=True); return True
    body = json.dumps({"text": prompt, "duration_seconds": dur, "prompt_influence": 0.6}).encode()
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/sound-generation",
        data=body,
        headers={"xi-api-key": KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            out_path.write_bytes(r.read())
        print(f"ok {name}", flush=True); return True
    except Exception as e:
        print(f"ERR {name}: {e}", flush=True); return False

for (n, p, d) in SFX:
    gen(n, p, d)
    time.sleep(0.4)

print("sfx done")
