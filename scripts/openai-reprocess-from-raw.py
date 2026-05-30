#!/usr/bin/env python3
"""Re-slice + re-chroma an existing raw OpenAI sheet without spending API
credits. Reads from public/assets/openai_v2/raw/<id>/<date>_raw.png and
writes the 9 sliced cells to public/images/openai_v2/<id>_<pose>.png.

Usage:
  scripts/openai-reprocess-from-raw.py <char_id> [<YYYY-MM-DD>]

If date is omitted, uses the latest raw archive for that char.
"""
import io, pathlib, sys
from PIL import Image

# Reuse the gen script's helpers.
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import importlib.util
spec = importlib.util.spec_from_file_location("gen", pathlib.Path(__file__).parent / "openai-spritesheet-gen.py")
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW_BASE = ROOT / "public/assets/openai_v2/raw"
OUT_DIR  = ROOT / "public/images/openai_v2"
POSES = ['portrait','south','east','east_attack','east_spell','east_block','east_ko','east_cheer','east_wound']

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    no_despill = '--no-despill' in flags
    feather = None
    tol = None
    for f in flags:
        if f.startswith('--feather='): feather = int(f.split('=')[1])
        if f.startswith('--tol='): tol = int(f.split('=')[1])
    if not args:
        sys.stderr.write(__doc__ + "\n  --no-despill  skip colour unmix (use for green-skinned chars: goblins, dragons)\n  --feather=N   override feather softness (default 66, recommended 14 for green-skin)\n  --tol=N       override hard-cut radius (default 64)\n"); sys.exit(2)
    # Apply overrides to gen module before processing.
    if feather is not None: gen.DESPILL_RADIUS = feather
    if tol is not None: gen.CHROMA_TOLERANCE = tol
    char_id = args[0]
    char_dir = RAW_BASE / char_id
    if not char_dir.exists():
        sys.stderr.write(f"ERROR: no raw archive for {char_id}\n"); sys.exit(1)
    raws = sorted(char_dir.glob("*_raw.png"))
    if len(args) >= 2:
        target = char_dir / f"{args[1]}_raw.png"
        if not target.exists():
            sys.stderr.write(f"ERROR: {target} not found\n"); sys.exit(1)
    else:
        target = raws[-1]
    print(f"[reprocess] raw → {target.name} (no_despill={no_despill})", flush=True)
    sheet = Image.open(target).convert("RGBA")
    if no_despill:
        # Hard-cut + soft alpha feather only; preserve native colours (e.g. goblin green skin).
        sheet = gen._key_color(sheet, gen.CHROMA_RGB, do_despill=False)
        # Skip the top-left fallback in no-despill mode too — fallback would re-key skin tones.
    else:
        sheet = gen.chroma_despill(sheet)
    cells = gen.slice_3x3(sheet)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for pose, cell in zip(POSES, cells):
        out_path = OUT_DIR / f"{char_id}_{pose}.png"
        cell = gen.normalize_cell(cell) if hasattr(gen, 'normalize_cell') else cell
        cell.save(out_path, optimize=True)
        print(f"  → {out_path.name}", flush=True)
    print("[reprocess] done.", flush=True)

if __name__ == "__main__":
    main()
