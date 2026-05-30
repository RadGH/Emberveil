#!/usr/bin/env python3
"""flag-openai-regens-for-review.py — M462

Retroactively enrol every openai-9pose-generated sprite that's already on
disk (under public/images/spritecook/ with a backup at
spritecook/_pre_openai/) into the OPEN review batch. The earlier
regenerations wrote the sprites + sidecar but never appended to the open
batch JSON, so the Pending tab on /assets/image-review-v2.html stayed
empty. This walks _pre_openai/ (every file there is, by definition, a
backup of a sprite that was replaced by openai-9pose) and adds entries.

The forward-fix is in scripts/openai-spritesheet-gen.py — future runs
auto-enrol so this one-shot won't be needed again.

Usage:
  python3 scripts/flag-openai-regens-for-review.py
"""
import json, pathlib, re, sys, time

ROOT = pathlib.Path("/home/radgh/claude/game13")
PRE_OPENAI = ROOT / "public/images/openai_v2/_pre_openai"  # M463 — moved from spritecook
SPRITECOOK = ROOT / "public/images/spritecook"
SIDECAR = ROOT / "public/assets/data/image-review-v2-openai-sidecar.json"
BATCH_INDEX = ROOT / "public/assets/data/image_review_batches/index.json"
BATCH_DIR = ROOT / "public/assets/data/image_review_batches"

POSES = ["portrait", "south", "east", "east_attack", "east_spell",
         "east_block", "east_ko", "east_cheer", "east_wound"]

def main():
    if not PRE_OPENAI.exists():
        print(f"no backup dir at {PRE_OPENAI} — nothing to flag.")
        return
    # Group backups by character id.
    by_char = {}
    for f in sorted(PRE_OPENAI.glob("*.png")):
        stem = f.stem
        for pose in POSES:
            if stem.endswith("_" + pose):
                char = stem[: -(len(pose) + 1)]
                by_char.setdefault(char, []).append(pose)
                break
    print(f"found {len(by_char)} regenerated characters with backups:")
    for c, poses in by_char.items():
        print(f"  {c}: {len(poses)} backed-up poses")

    # Load sidecar for prompt text per character.
    sidecar = {}
    if SIDECAR.exists():
        try:
            sc = json.loads(SIDECAR.read_text())
            for e in sc.get("entries", []):
                k = e.get("group") + "|" + e.get("pose", "")
                sidecar[k] = e
        except Exception as ex:
            print(f"warn: sidecar parse failed: {ex}")

    idx = json.loads(BATCH_INDEX.read_text())
    open_b = idx["open"]
    batch_path = BATCH_DIR / f"{open_b['id']}.json"
    batch = json.loads(batch_path.read_text())
    if not isinstance(batch.get("entries"), list):
        batch["entries"] = []

    # Skip characters that already have un-approved openai entries.
    existing_chars = {
        e.get("group") for e in batch["entries"]
        if e.get("source") == "openai-9pose" and not e.get("approved")
    }
    print(f"open batch has {len(existing_chars)} chars already pending.")

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    added = 0
    for char, _ in by_char.items():
        if char in existing_chars:
            continue
        # Enumerate live files for this char in BOTH openai_v2 (M463
        # primary bucket) and spritecook (legacy, in case nothing has
        # been moved). M463 BUGFIX: previously this used
        # `SPRITECOOK.glob(f"{char}_*.png")` which prefix-matched longer
        # ids (char='bandit' picked up 'bandit_captain_*.png' too).
        # Restrict to <char>_<pose>.png with `pose` in the known POSES set.
        OPENAI_V2 = ROOT / "public/images/openai_v2"
        candidates = []
        seen_poses = set()
        for pose in POSES:
            for d in (OPENAI_V2, SPRITECOOK):
                f = d / f"{char}_{pose}.png"
                if f.exists() and pose not in seen_poses:
                    candidates.append((f, pose))
                    seen_poses.add(pose)
                    break
        for live, pose in candidates:
            sidecar_entry = sidecar.get(f"{char}|{pose}", {})
            prompt = sidecar_entry.get("prompt") or "(openai-9pose; prompt not captured)"
            live_rel = "../images/" + str(live.relative_to(ROOT / "public/images")).replace("\\", "/")
            backup = PRE_OPENAI / live.name
            old_rel = ("../images/" + str(backup.relative_to(ROOT / "public/images")).replace("\\", "/")) if backup.exists() else live_rel
            batch["entries"].append({
                "id": f"openai9_{char}_{pose}",
                "group": char,
                "pose": pose,
                "category": "companion",
                "source": "openai-9pose",
                "prompt": prompt,
                "old": old_rel,
                "new": live_rel,
                "live": live_rel,
                "approved": False,
                "addedAt": now,
                "note": "retro-flagged by flag-openai-regens-for-review.py",
            })
            added += 1
        existing_chars.add(char)
    batch_path.write_text(json.dumps(batch, indent=2) + "\n")
    print(f"\nadded {added} entries to open batch {open_b['id']}.")
    print(f"run `node scripts/build-image-review-v2.cjs` then visit the page.")


if __name__ == "__main__":
    main()
