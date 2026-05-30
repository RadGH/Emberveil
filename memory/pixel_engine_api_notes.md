# Pixel Engine API — Notes for the Re-redesign Pipeline

**Updated 2026-04-14 after Phase A empirical validation.** Previous notes
made incorrect assumptions about both `/animate` and `/keyframes`. The
corrected behavior is below.

---

## Base URL & Auth

- **Base URL:** `https://api.pixelengine.ai/functions/v1`
- **Auth header:** `Authorization: Bearer pe_sk_...`
- Key file: `/home/radgh/claude/assets/references/pixel-engine-api-key.txt`
  (single line, `pe_sk_` prefix). **Do NOT log the key.**

## Endpoints (verified)

| Endpoint | Method | Cost | Purpose |
|----------|--------|------|---------|
| `/balance` | GET | free | Returns `{monthly_balance, purchased_balance, total_balance, reserved, available}` |
| `/animate` | POST | **20 credits** | Image-to-video. Subtle motion around the reference. |
| `/keyframes` | POST | 24 credits | Interpolates between supplied keyframe anchors — NOT "6 poses from 1 portrait". |
| `/jobs?id=<id>` | GET | free | Poll job. Terminal statuses: `success`, `failure`, `cancelled`, `error`. |
| `/cancel` | POST | free | Body: `{"api_job_id": "..."}`. Refunds reserved credits. |
| `/pixelate` | POST | free | Downsample an image to clean pixel art. |
| `/retake` | POST | 24 | Regen specific frames of an existing job. |
| `/enhance-prompt` | POST | free | Prompt rewrite. |

## /animate — actual request shape (verified)

Minimum required: `prompt` (non-empty string) + `image` (base64 PNG).

```json
{
  "prompt": "...",
  "image": "<base64>",
  "matte_color": "00ff00",
  "output_frames": 2
}
```

Response on submit:
```json
{ "api_job_id": "uuid", "status": "queued", "error": null }
```

Response on job poll (`GET /jobs?id=...`) when complete:
```json
{
  "api_job_id": "...",
  "status": "success",
  "billing": { "credits_held": 20, "credits_charged": 20, "hold_status": "captured" },
  "inputs": { "model": "pixel-engine-v1.1", "output_format": "webp", "output_frames": 2, ... },
  "output": {
    "url": "https://...supabase.co/.../signed?token=...",
    "content_type": "image/webp",
    "metadata": { "width": 256, "height": 256, "frame_count": 2 },
    "expires_at": "<24h>"
  }
}
```

Output is an **animated webp** with `frame_count` frames at 256x256 (matches
input dimensions). The signed URL expires in ~24h — download immediately.

## ⚠️ CRITICAL: /animate does NOT reinterpret pose from prompt

**Empirically verified on 2026-04-14 with the Warrior test batch.**

I submitted 6 `/animate` calls with the same 256x256 Warrior reference
image but wildly different prompts:

- `front_idle`: "facing camera, idle stance, full body"
- `east_idle`: "facing right (east profile), idle ready stance, full body"
- `east_attack`: "facing right, mid-swing sword attack, dynamic motion"
- `east_spell`: "shouting war cry with glowing aura, battle shout"
- `east_down`: "knocked unconscious lying on ground, eyes closed"
- `portrait`: "head-and-shoulders portrait, looking at viewer"

**All 6 outputs were visually near-identical.** Every output was a
head-and-shoulders portrait of the same Warrior in the same pose as the
reference, with only subtle (1-2 pixel) animation deltas between them.
No full-body was produced. No "east profile" was produced. No attack
motion was produced. No "lying on ground" was produced. The prompt had
effectively zero influence on the pose/composition — only on trivial
surface details.

**Conclusion:** `/animate` is image-to-video animation. It animates the
reference image with a small amount of motion. It does NOT re-imagine
the subject into a different pose/framing from the prompt. The reference
image composition dominates the output.

**This means the "6 variants from 1 portrait" pipeline is fundamentally
unworkable with `/animate`.** The Warrior portrait is a head-and-
shoulders shot, so every animate call returns a head-and-shoulders shot.

## What about /keyframes?

`/keyframes` is **keyframe interpolation between supplied anchor frames**.
You provide 2+ reference frames and it generates in-between frames. It
cannot produce multiple distinct poses from a single input either — if
you only have 1 reference, there is nothing to interpolate to.

## What would actually work

Not in scope for this agent; flagging for decision:

1. **Pose references per variant.** Hand-draw or source an existing
   full-body `east_idle` Warrior image (from stock pixel art or another
   AI tool that accepts pose+character conditioning, e.g. ControlNet),
   then use `/animate` on each pose reference to add subtle motion.
   Pixel Engine cannot generate the poses itself; it can only animate
   them once you have them.
2. **Different service.** An image-to-image service with stronger prompt
   adherence (SDXL + IP-Adapter, Nano-Banana, PixelLab's `animate_character`
   skeleton rig, etc.) may actually reimagine the reference into new
   poses. Pixel Engine will not.
3. **Prompt-only generation (no image).** Unknown whether `/animate`
   accepts a prompt-only request — did not test, but if it does, the
   output would not resemble the reference character at all, which
   defeats the "same face, same armor" consistency requirement.

## Cost accounting — Phase A burn

- Starting balance: **16,018**
- Warrior validation: **6 × 20 = 120 credits** (all `captured`)
- Ending balance: **15,898**
- No further spend; batch halted.

## Files produced

- `public/images/sprites_pixelengine/warrior_{variant}.webp` (raw)
- `public/images/sprites_pixelengine/warrior_{variant}.png` (frame 0 extract)
- `public/images/sprites_pixelengine/warrior_{variant}_alpha.png` (chroma-keyed)
- `memory/pixel_engine_jobs/warrior_{variant}_submit.json`
- `memory/pixel_engine_jobs/warrior_{variant}_result.json`
