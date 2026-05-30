#!/usr/bin/env python3
"""Add companion animation sprites to assets.json"""
import json
import pathlib

COMPANIONS = [
    "dire_wolf", "forest_owl", "ember_drake", "shadow_cat", "crystal_golem",
    "spirit_wisp", "bone_hound", "ice_sprite", "swamp_frog", "void_moth"
]

assets_file = pathlib.Path("public/assets/assets.json")
assets_data = json.loads(assets_file.read_text())

# Add companion animation sprites
for companion in COMPANIONS:
    for animation in ["walk", "attack"]:
        sprite_id = f"{companion}_south_{animation}"
        sprite_entry = {
            "id": sprite_id,
            "name": f"{companion.title().replace('_', ' ')} {animation.title()} Animation",
            "category": "companion_sprites",
            "source": "openai",
            "file": f"../images/sprites/{sprite_id}.png",
            "notes": f"Generated companion {animation} animation frame for {companion}"
        }

        # Check if entry already exists
        if not any(img["id"] == sprite_id for img in assets_data["images"]):
            assets_data["images"].append(sprite_entry)
            print(f"Added {sprite_id}")
        else:
            print(f"Skip {sprite_id} (already exists)")

# Write back to file
assets_file.write_text(json.dumps(assets_data, indent=2))
print("Updated assets.json")