#!/usr/bin/env python3
"""
fix-sliced-bleed.py
===================
Repair 3×3 OpenAI sprite sheets where the rendered character bled across a
cell boundary (e.g. east_attack's left arm extends into east_spell's space).

Two strategies are supported per row:

  1. --shift "row=N,cols=2-3,dx=14"
       Re-slice that row with a +dx pixel shift on the named columns. dx is
       in pixels relative to the raw 1024-wide sheet; positive dx pulls
       content *from the previous cell's right edge* into the current cell.
       Run again per affected row if multiple rows are misaligned.

  2. --auto <char_id>
       Detect non-transparent bounding box per cell post-chroma; if a cell's
       content touches the left edge, shift it right and bring the missing
       slice from the previous cell. Use when manual measurement is tedious.

The script reads the dated raw archive from
public/assets/openai_v2/raw/<id>/<date>_raw.png, re-slices, applies the
chroma_despill + normalize_cell helpers from openai-spritesheet-gen.py, and
writes the 9 cells to public/images/openai_v2/<id>_<pose>.png.

Usage examples:

  # Manual mode — shift columns 2 and 3 of row 2 right by 18 pixels, taking
  # the 18px from the right edge of the previous cell:
  python3 scripts/fix-sliced-bleed.py pet_fire_elemental --row 2 --cols 2,3 --dx 18

  # Auto mode — detect left-edge bleed and shift each row accordingly:
  python3 scripts/fix-sliced-bleed.py pet_fire_elemental --auto

  # Specify a specific raw archive date:
  python3 scripts/fix-sliced-bleed.py bandit_captain --auto --date 2026-05-11

Row indexing (1-based for the CLI; matches the layout in the gen prompt):
  Row 1: portrait | south       | east
  Row 2: east_atk | east_spell  | east_block
  Row 3: east_ko  | east_cheer  | east_wound
"""
import argparse, importlib.util, io, pathlib, sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW_BASE = ROOT / "public/assets/openai_v2/raw"
OUT_DIR  = ROOT / "public/images/openai_v2"

# Reuse helpers from the gen script.
spec = importlib.util.spec_from_file_location(
    "gen", pathlib.Path(__file__).parent / "openai-spritesheet-gen.py"
)
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

POSES = gen.POSES  # 9 entries in row-major order

def latest_raw(char_id):
    d = RAW_BASE / char_id
    raws = sorted(d.glob("*_raw.png"))
    if not raws:
        sys.stderr.write(f"ERROR: no raw archive for {char_id}\n"); sys.exit(1)
    return raws[-1]

def slice_with_shifts(sheet, row_shifts):
    """row_shifts: dict row(1..3) → list of dx-per-col (length 3, defaulting to 0).
    Positive dx for col c moves cell c's window to the LEFT by dx so that the
    cell *includes* dx pixels of content from col c-1's right side. Practically:
    cell c's new x_start = c*cw - dx.
    """
    w, h = sheet.size
    cw, ch = w // 3, h // 3
    cells = []
    for r in range(3):
        dxs = row_shifts.get(r + 1, [0, 0, 0])
        for c in range(3):
            dx = dxs[c] if c < len(dxs) else 0
            x0 = max(0, c * cw - dx)
            x1 = min(w, x0 + cw)
            y0, y1 = r * ch, r * ch + ch
            cells.append(sheet.crop((x0, y0, x1, y1)))
    return cells

def auto_detect_shifts(sheet):
    """Find true vertical seams between cells by scanning each row for the
    column with the LOWEST non-green pixel count in two seam search windows
    (one near x=cw, one near x=2*cw). Returns per-row (col0_xstart, col1_xstart,
    col2_xstart) anchor positions so slice_with_anchors can re-slice the row
    using those instead of equal cw boundaries.

    The bleed signature is when the LOWEST-content column in the seam zone
    sits significantly off the nominal cw boundary — typically the model
    packed too much content into one cell and the natural gap shifted.
    """
    w, h = sheet.size
    cw, ch = w // 3, h // 3
    import statistics
    anchors = {}
    px = sheet.load()
    for r in range(3):
        y0, y1 = r * ch, (r + 1) * ch
        counts = []
        for x in range(w):
            n = 0
            for y in range(y0, y1):
                rr, gg, bb, aa = px[x, y]
                if aa > 100 and not (gg > 170 and rr < 120 and bb < 120):
                    n += 1
            counts.append(n)
        # Smooth a bit so isolated noise doesn't dominate.
        win = 8
        sm = [statistics.mean(counts[max(0, x-win): x+win+1]) for x in range(w)]
        # Search for seams in two 120px windows centred on the nominal boundaries.
        seam_zones = [(cw - 60, cw + 60), (2*cw - 60, 2*cw + 60)]
        seams = []
        for z0, z1 in seam_zones:
            xmin = min(range(z0, z1), key=lambda x: sm[x])
            # Reject "no real seam" when min value is high (>5% of ch)
            if sm[xmin] > ch * 0.05:
                xmin = (z0 + z1) // 2  # fall back to centre
            seams.append(xmin)
        anchors[r + 1] = (0, seams[0], seams[1])
        if abs(seams[0] - cw) > 6 or abs(seams[1] - 2*cw) > 6:
            print(f"  row {r+1}: seams at {seams} (nominal {cw}, {2*cw})")
    return anchors


def slice_with_anchors(sheet, anchors):
    """Slice using per-row anchor x-starts: [(0, s1, s2)] for each row.
    Cell 0 spans x=0..s1, cell 1 spans s1..s2, cell 2 spans s2..w.
    The cells will have UNEQUAL widths — normalize_cell handles that by
    bbox-cropping + center-padding to 256 square.
    """
    w, h = sheet.size
    ch = h // 3
    cells = []
    for r in range(3):
        x0a, x1a, x2a = anchors.get(r + 1, (0, w // 3, 2 * w // 3))
        bounds = [(x0a, x1a), (x1a, x2a), (x2a, w)]
        for (xs, xe) in bounds:
            cells.append(sheet.crop((xs, r * ch, xe, (r + 1) * ch)))
    return cells

def write_cells(cells, char_id):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR = OUT_DIR / "_pre_openai"
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    for pose, cell in zip(POSES, cells):
        # Despill per-cell (the slice was raw — chroma must run on the cell now).
        cell = gen.chroma_despill(cell.convert("RGBA"))
        normalized = gen.normalize_cell(cell)
        out = OUT_DIR / f"{char_id}_{pose}.png"
        if out.exists():
            try:
                (BACKUP_DIR / out.name).write_bytes(out.read_bytes())
            except Exception:
                pass
        normalized.save(out, optimize=True)
        written.append(str(out))
        print(f"  → {out.name}")
    return written

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("char_id")
    ap.add_argument("--date", default=None, help="YYYY-MM-DD raw archive date")
    ap.add_argument("--auto", action="store_true", help="auto-detect bleeds")
    ap.add_argument("--row", type=int, action="append", default=[], help="1-indexed row to shift")
    ap.add_argument("--cols", action="append", default=[], help="comma-separated cols to shift (1-indexed)")
    ap.add_argument("--dx", type=int, action="append", default=[], help="px to pull from previous cell")
    args = ap.parse_args()

    raw_path = (RAW_BASE / args.char_id / f"{args.date}_raw.png") if args.date else latest_raw(args.char_id)
    if not raw_path.exists():
        sys.stderr.write(f"ERROR: raw not found: {raw_path}\n"); sys.exit(1)
    print(f"raw: {raw_path}")
    sheet = Image.open(raw_path).convert("RGBA")

    if args.auto:
        anchors = auto_detect_shifts(sheet)
        print(f"anchors: {anchors}")
        cells = slice_with_anchors(sheet, anchors)
    else:
        row_shifts = {1:[0,0,0], 2:[0,0,0], 3:[0,0,0]}
        for i, row in enumerate(args.row):
            cols = [int(x) for x in (args.cols[i] if i < len(args.cols) else "").split(",") if x]
            dx = args.dx[i] if i < len(args.dx) else 0
            for c in cols:
                row_shifts[row][c - 1] = dx
        print(f"row_shifts: {row_shifts}")
        cells = slice_with_shifts(sheet, row_shifts)
    write_cells(cells, args.char_id)
    print("done.")

if __name__ == "__main__":
    main()
