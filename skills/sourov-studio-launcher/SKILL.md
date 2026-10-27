---
name: sourov-studio-launcher
description: Build and operate the Sourov Studio launcher — one Resolve automation entry point with CLEAN/BOOK/TEACH modes, reusing existing MagicScript catalogue and helpers.
version: 1.0.0
metadata:
  tags: [resolve, davinci, automation, studio, launcher, audio-cleanup, book-reading, teaching]
  category: video-production
---

# Sourov Studio Launcher

## When to Use

Use when building or operating a unified Resolve automation launcher with three modes:
- **CLEAN** — Audio cleanup: silence removal, Voice Isolation, loudness normalization, subtitle export
- **BOOK** — Book reading videos: performance subtitles, doodle illustrations, presenter layout
- **TEACH** — Teaching visuals: charts, diagrams, flowcharts, timelines synchronized to explanation

Do not use for general video editing, color grading, or unrelated Resolve tasks.

## Prerequisites

- DaVinci Resolve Studio 21.1+ (MagicScript requires Studio)
- MagicScript installed and configured (`%APPDATA%\Blackmagic Design\DaVinci Resolve\Support\MagicScript\`)
- Existing script library at `E:\Resolve-Automation\scripts\`
- Hermes agent or equivalent automation host

## Implementation Order

```text
CLEAN -> test -> BOOK -> test -> TEACH -> test
```

Preserve every mode that passes. Don't rebuild the script library.

## Mode Specifications

### CLEAN Mode

| Parameter | Starting Value |
|---|---|
| Pause threshold | > 1.2 seconds |
| Speech protection | 0.15s before/after |
| Filler candidates | `um`, `uh` |
| Voice Isolation | Enabled, amount 50 |
| Programme loudness | -16 LUFS integrated |
| True-peak ceiling | -1 dBTP |

Procedure:
1. Transcribe speech with word timings (use recording's language)
2. Detect silences using timestamps (not just audio levels)
3. Cut video and dialogue together; close gaps without losing sync
4. Apply 5ms boundary fades; verify fades don't remove phonemes
5. Enable Voice Isolation on dialogue only
6. Normalize using programme/group gain (not per-fragment)
7. Export subtitles as SRT, transcript as TXT
8. Verify loudness measurement after Voice Isolation

### BOOK Mode

Layout: Left 2/3 reading text + doodles, Right 1/3 presenter (1280|640 at 1920 wide).

Procedure:
1. Reuse CLEAN's transcription and audio processing
2. Preserve performance pauses; mark hesitations (don't delete)
3. Reuse `_performance_subtitles.py` and `_book_nouns.py` helpers
4. Animate against post-edit speech timings
5. Highlight words when timestamps exist; otherwise animate phrases
6. Match book text against speech; flag uncertainty
7. Start with 2-4 text lines; display phrases, not whole pages
8. Keep one animation group active; use emphasis, fades, reveals

### TEACH Mode

Templates: Heading, Comparison, Flowchart, Timeline, Diagram, Chart.

Procedure:
1. Reuse CLEAN when checkpoints match; otherwise run CLEAN first
2. Build one visual per teaching point
3. Reveal elements alongside the explanation
4. Keep labels visible throughout cues
5. Charts require evidence for values; never invent numbers
6. Prefer editable Fusion elements; reuse asset helpers
7. Verify asset paths and fonts before rendering

## Reuse Map

| Work | Script/Helper |
|---|---|
| Orchestration | `_sourov.py`, `_lib.py` |
| Cleanup | `_tutorial_plan.py`, `_tutorial_runtime.py` |
| Reading typography | `_performance_subtitles.py`, `_performance_subtitles.lua` |
| Reading illustrations | `_book_nouns.py`, `_book_render_asset.py`, `_asset_picker.py` |
| Fusion construction | `_sourov_fx.py`, `_motion_text.py` |

Find each helper's `sourov_*.py` wrapper. Don't launch underscore modules directly.

## Test Protocol

| Stage | Required Checks |
|---|---|
| Inspect | Imports, manifests, dependencies, APIs, paths |
| CLEAN | One clip; two clips; join boundary |
| BOOK | Typography, timing, doodles, quotation fidelity |
| TEACH | Diagram timing, labels, chart values, visibility |
| Rerun | No repeated cuts/gain/graphics |
| Failure | Missing media/input; source remains unchanged |
| Persistence | Save, reopen, inspect results |

Use 30-60 second setup samples with speech, pauses, and fillers.

## Pitfalls

- Blackmagic MCP `run_script` timeout: 60 seconds — keep transcription outside this
- Don't edit during rendering; don't poll inside scripts
- Don't force-kill Resolve after hangs
- Rebuilding timelines can discard effects — inspect before rebuilding
- Never duplicate generated graphics/subtitle tracks on reruns
- Preserve user edits during reruns; ask before replacing
- Source changes invalidate content plans; transcript changes invalidate word timings
- Don't create another management framework

## Verification

Return this result table:

```text
MODE | PASS/FAIL/UNTESTED/UNSUPPORTED | EVIDENCE | NEXT ACTION
```

Report: saved script path, actual menu name, reused catalogue IDs, changes, preview paths.

## Sources

- `E:\Resolve-Automation\SCRIPT-GUIDE.md`
- `E:\Resolve-Automation\HOW-TO-USE-THE-SCRIPTS.md`
- `E:\Resolve-Automation\HEALTH-REPORT.md`
- MagicScript docs: https://magic-toolkit.com/magicscript
- Resolve 21 New Features Guide (subtitle retiming p.78-79, Text+ p.117)
