#!/usr/bin/env python3
"""M65/M66: Generate full OpenAI sprite roster — south idle, portrait, east_attack, east_spell, death.

Uses gpt-image-1 at 1024x1024, medium quality, transparent background.
Skips files that already exist and are non-trivial. Idempotent — safe to re-run.
"""
import json, base64, urllib.request, pathlib, time, sys, os

KEY = pathlib.Path("/home/radgh/claude/secrets/openai-api-key.txt").read_text().strip()
SPRITES = pathlib.Path("/home/radgh/claude/game13/public/images/sprites")
PORTRAITS = pathlib.Path("/home/radgh/claude/game13/public/images/portraits")
SPRITES.mkdir(parents=True, exist_ok=True)
PORTRAITS.mkdir(parents=True, exist_ok=True)
LOG = pathlib.Path("/home/radgh/claude/game13/scripts/gen_openai_roster.log")

STYLE_SPRITE = "16-bit SNES JRPG pixel art, centered single figure, clean outlines, rich palette, transparent background, full body visible, no shadow, no background, no text, no ground, hi-res 2x pixel art rendered sharp"
STYLE_PORTRAIT = "16-bit JRPG character portrait in the style of classic SNES Final Fantasy / Chrono Trigger headshot, pixel art, head and shoulders, facing camera, clean outlines, rich palette, transparent background, no text"

# (name, short descriptor). Descriptor is used to build all 5 prompts consistently.
ROSTER = [
    # heroes
    ("fighter",          "human male fighter in plate armor with steel sword and shield"),
    ("mage",             "human male mage in blue robes with wooden staff"),
    ("cleric",           "human female cleric in white and gold vestments with holy mace"),
    ("rogue",            "human female rogue in black leather with twin daggers, hood up"),
    ("ranger",           "human male ranger in green leather with longbow and quiver"),
    ("paladin",          "human male paladin in gleaming silver plate with greatsword"),
    ("warlock",          "human female warlock in dark purple robes with eldritch tome"),
    ("bard",             "human male bard in colorful tunic with lute"),
    ("druid",            "human female druid in earthy robes with wooden staff wrapped in vines"),
    ("necromancer",      "human male necromancer in black robes with bone staff"),
    ("pyromancer",       "human female pyromancer in red-orange robes with fire conjured in hand"),
    ("stormcaller",      "human male stormcaller in blue robes crackling with lightning"),
    ("oracle",           "human female oracle in white robes with glowing blue eyes"),
    ("swashbuckler",     "human male swashbuckler in red coat with rapier"),
    ("warrior",          "barbarian warrior in furs with great axe"),
    ("demon_hunter",     "demon hunter in leather with twin crossbows, crimson cloak"),
    ("dragon_knight",    "dragon knight in scaled armor with draconic greatsword"),
    # companions
    ("dire_wolf",        "large grey dire wolf facing forward, fierce eyes"),
    ("forest_owl",       "mystical brown forest owl with wings slightly spread"),
    ("ember_drake",      "small red ember drake dragon with tiny wings"),
    ("shadow_cat",       "sleek black shadow cat with glowing purple eyes and wispy tail"),
    ("crystal_golem",    "small crystal golem with blue crystalline limbs and glowing core"),
    ("spirit_wisp",      "floating blue-white spirit wisp, ethereal glow"),
    ("bone_hound",       "skeletal bone hound with greenish necromantic glow"),
    ("ice_sprite",       "small cyan ice sprite with icicle wings, crystalline form"),
    ("swamp_frog",       "large mossy swamp frog with dripping slime"),
    ("void_moth",        "large void moth with purple starry cosmic wings"),
    ("war_dog",          "armored war mastiff with spiked collar"),
    ("scavenger",        "scrappy small hyena-like scavenger"),
    # enemies — act 1-2
    ("goblin_scout",     "small green goblin scout with dagger and leather tunic"),
    ("goblin_warrior",   "green goblin warrior with rusted sword and shield"),
    ("goblin_shaman",    "green goblin shaman in hide robes with bone totem staff"),
    ("goblin_warlord",   "large green goblin warlord in crude plate with battle axe"),
    ("bandit",           "human bandit in brown leather with short sword, face scarf"),
    ("bandit_captain",   "human bandit captain in studded leather with cutlass and pistol"),
    ("imp",              "small red demonic imp with bat wings and forked tail"),
    ("giant_spider",     "large black giant spider with glinting red eyes"),
    ("corrupted_wolf",   "corrupted wolf with glowing red eyes and black oozing fur"),
    ("corrupted_bear",   "corrupted bear with glowing red eyes and black oozing fur"),
    ("cinder_hound",     "fiery cinder hound with glowing ember cracks along its back"),
    # enemies — act 3-4
    ("veil_cultist",     "hooded veil cultist in dark purple robes holding a curved dagger"),
    ("veil_sorcerer",    "veil sorcerer in violet robes channeling void energy"),
    ("veil_warden",      "veil warden in dark plate armor with halberd"),
    ("ash_wraith",       "ghostly ash wraith with hollow white eyes and drifting ash robe"),
    ("void_shade",       "dark purple void shade with starfield body"),
    ("void_wraith",      "wispy void wraith with cosmic energy and glowing eyes"),
    ("demon_brute",      "hulking red demon brute with horns and massive club"),
    ("hell_knight",      "hell knight in blackened spiked armor with flaming sword"),
    ("abyssal_knight",   "abyssal knight in deep blue void-marked armor with black blade"),
    ("dragon_whelp",     "small red dragon whelp hatchling"),
    ("dragon_hatchling", "tiny green dragon hatchling"),
    ("frost_wyrmling",   "small pale blue frost wyrmling dragon"),
    ("storm_drake",      "medium storm drake with crackling blue lightning along its wings"),
    ("molten_golem",     "molten stone golem with lava cracks and burning core"),
    ("lava_titan",       "massive lava titan with obsidian plates and glowing magma"),
    ("primordial_elemental", "primordial elemental of swirling earth, water, fire, and air"),
    ("wyrm_warrior",     "lizardfolk wyrm warrior in scaled armor with spear"),
    # bosses
    ("shadow_wyrm",      "massive shadow wyrm dragon, black scales, purple void breath"),
    ("star_horror",      "cosmic star horror, eldritch being of stars and tentacles"),
    ("void_prophet",     "void prophet in star-studded robes with glowing third eye"),
    ("grax_veil_touched","Grax the veil-touched, a hulking humanoid with purple crystal growths"),
    ("archfiend_malgrath","Archfiend Malgrath, towering winged demon lord with hellfire greatsword"),
    ("emberveil_sovereign","the Emberveil Sovereign, regal flame-crowned monarch wreathed in ember mist"),
    ("cosmic_titan",     "cosmic titan colossus of stars and nebulae"),
    ("genesis_worm",     "massive genesis worm, ancient purple wyrm with glowing segmented body"),
    ("reality_shard",    "floating reality shard, a crystalline geometric entity with prismatic energy"),
    ("the_unraveler",    "the Unraveler, a robed faceless entity pulling threads of reality"),
    ("the_architect",    "the Architect, an ancient robed figure with glowing blueprints of reality"),
    # Act 6 dragon expansion (added M79)
    ("dragon_cultist",   "dragon cultist in dark red robes with scaled shoulders and a ritual dagger, draconic runes glowing"),
    ("storm_dragon",     "large storm dragon with cobalt blue scales crackling with lightning, wings unfurled"),
    ("ancient_dragon",   "massive ancient dragon with weathered golden scales and glowing amber eyes"),
    ("dragon_king",      "Bahamorth the Dragon King, regal platinum dragon with a horned crown and majestic wings"),
    ("frost_wyrm",       "frost wyrm dragon with pale blue-white scales and icy breath, long serpentine body"),
]

def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with LOG.open("a") as f:
        f.write(line + "\n")

def call(prompt, out_path):
    if out_path.exists() and out_path.stat().st_size > 20000:
        return "skip"
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
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.loads(r.read())
            out_path.write_bytes(base64.b64decode(data["data"][0]["b64_json"]))
            return "ok"
        except Exception as e:
            if attempt == 2:
                return f"ERR {e}"
            time.sleep(5)

def variants(name, desc):
    return [
        (SPRITES / f"{name}_south.png",       f"{STYLE_SPRITE}. {desc}, facing camera (south), neutral idle pose"),
        (PORTRAITS / f"{name}.png",            f"{STYLE_PORTRAIT}. {desc}"),
        (SPRITES / f"{name}_east.png",        f"{STYLE_SPRITE}. {desc}, facing right (east), neutral idle standing pose, side profile"),
        (SPRITES / f"{name}_east_attack.png", f"{STYLE_SPRITE}. {desc}, facing right (east) in a dynamic melee attack pose, weapon swinging"),
        (SPRITES / f"{name}_east_spell.png",  f"{STYLE_SPRITE}. {desc}, facing right (east) casting a spell with glowing magical energy around the hands"),
        (SPRITES / f"{name}_death.png",       f"{STYLE_SPRITE}. {desc}, collapsed unconscious on the ground, eyes closed, lying down"),
    ]

def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None  # e.g. "south" to only do idle
    total = 0
    for name, desc in ROSTER:
        for out, prompt in variants(name, desc):
            if only and only not in out.name:
                continue
            res = call(prompt, out)
            log(f"{out.name}: {res}")
            if res == "ok":
                total += 1
                time.sleep(0.5)
    log(f"DONE. generated={total}")

if __name__ == "__main__":
    main()
