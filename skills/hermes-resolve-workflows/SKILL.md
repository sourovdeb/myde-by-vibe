---
name: hermes-resolve-workflows
description: Comprehensive Resolve workflow contract with CLEAN, BOOK, and TEACH modes. Covers audio cleanup (silence removal, Voice Isolation, loudness normalization), reading typography with performance subtitles, and teaching visuals (charts, diagrams, timelines). Build one launcher (Sourov Studio) with mode dropdown.
version: 1.0.0
metadata:
  author: Sourov Deb
  date: 2026-10-27
  source: E:\knowledge\New Good Stuff from chatgpt\HERMES_RESOLVE_WORKFLOWS.md
  tags: [resolve, davinci, video, audio, cleanup, subtitles, teaching, blender, fusion]
---

# Hermes Resolve Workflows

One launcher with three modes: CLEAN, BOOK, TEACH. Reuse code between recordings. Reduce menus, not supporting code.

## Implementation Order

```
CLEAN -> test -> BOOK -> test -> TEACH -> test
```

Preserve every mode that passes. Execute work, not another proposal.

## 1. Inspect and Reuse

Read supplied documentation, then inspect actual implementations. Documentation doesn't prove runtime success.

**Key paths:**
```
E:\Resolve-Automation\SCRIPT-GUIDE.md
E:\Resolve-Automation\HOW-TO-USE-THE-SCRIPTS.md
E:\Resolve-Automation\HEALTH-REPORT.md
E:\Resolve-Automation\scripts\
E:\Resolve-Automation\tools\install_bundle.py
%APPDATA%\Blackmagic Design\DaVinci Resolve\Support\MagicScript\MAGICSCRIPT.md
%APPDATA%\Blackmagic Design\DaVinci Resolve\Support\MagicScript\CATALOGUE.md
```

**Reuse these helpers:**
| Work | Inspect and reuse |
|---|---|
| Orchestration | `_sourov.py`, `_lib.py` |
| Cleanup | `_tutorial_plan.py`, `_tutorial_runtime.py` |
| Reading typography | `_performance_subtitles.py`, `_performance_subtitles.lua` |
| Reading illustrations | `_book_nouns.py`, `_book_render_asset.py`, `_asset_picker.py` |
| Fusion construction | `_sourov_fx.py`, `_motion_text.py` |

Find each helper's `sourov_*.py` wrapper. Don't launch underscore modules. Reuse catalogue entries by function.

## 2. Runtime and Launcher

- MagicScript requires Studio 21.1+. Don't upgrade software without approval.
- Reuse existing Resolve connection. Test a read before writes.
- Use MagicScript's execution context. Reuse its documented catalogue runner.
- Add at most one launcher. Expose modes through a dropdown.
- Run one job at a time. Detect hardware before choosing workload.
- Render setup previews at 720p. Don't change playback to 1fps.
- Blackmagic MCP run_script timeout: 60 seconds. Keep transcription outside that timeout.

## 3. Inputs and Reuse

- Accept folders or ordered files. Otherwise use the open timeline.
- Leave recordings where they exist. Keep media outside script folders.
- Import recordings into Media Pool. Create SOURCE using supplied order.
- Save the project before editing. Create a working timeline copy.
- Keep SOURCE and media unchanged. Verify a project backup exists.
- Record source/settings/code fingerprints in checkpoints.
- Never recut a completed cleanup. Never normalize an output twice.

## 4. CLEAN Mode

Audio cleanup pipeline. These are proposed starting settings, not Blackmagic requirements.

| Parameter | Starting value |
|---|---|
| Pause threshold | More than 1.2 seconds |
| Speech protection | 0.15 seconds before/after |
| Filler candidates | `um`, `uh` |
| Voice Isolation | Enabled; amount 50; verify scale |
| Programme loudness | -16 LUFS integrated |
| True-peak ceiling | -1 dBTP |
| Additional effects | None |
| Full-video export | Off unless requested |

**Procedure:**
1. Transcribe speech with word timings. Use the recording's language.
2. Apply pause thresholds and protection. Cut video and dialogue together.
3. Close gaps without losing synchronization. Use 5ms audio fades.
4. Enable Voice Isolation on dialogue. Verify amount and state.
5. Normalize using programme/group gain. Don't normalize each fragment independently.
6. Complete cuts before creating subtitles. Time captions against the result.
7. Export subtitles as SRT. Export transcript as TXT.

**Rules:**
- Silence detection isn't filler detection. Require timestamps before deleting fillers.
- Don't run AI Audio Assistant. Don't add EQ, compression, de-essing, or limiting.
- Don't add music or grading. Don't replace the speaker's voice.
- Prioritize peak protection over loudness. Report measurements and shortfalls.

## 5. BOOK Mode

Reading companion with performance typography. Reuse transcription and audio processing from CLEAN.

**Layout:**
```
Left 2/3: reading text and doodles
Right 1/3: presenter
1920-wide example: 1280 | 640 pixels
```

**Procedure:**
1. Rebuild BOOK from preserved SOURCE. Never restore pauses by guessing.
2. Preserve performance pauses by default. Mark hesitations; don't delete them.
3. Reuse performance-subtitle and illustration helpers.
4. Animate against post-edit speech timings. Highlight words when timestamps exist.
5. Match book text against speech. Check quotations and names.
6. Start with 2-4 text lines. Display phrases, not whole pages.
7. Use emphasis, fades, and reveals. Avoid per-word Fusion compositions.

## 6. TEACH Mode

Teaching visuals matched to explanations. Reuse CLEAN when checkpoints match.

| Template | Content |
|---|---|
| Heading | Section or definition |
| Comparison | Concepts or examples |
| Flowchart | Sequence or procedure |
| Timeline | Events and dates |
| Diagram | Parts or relationships |
| Chart | Supplied numerical data |

**Rules:**
- Build what this recording needs. Use one visual per point.
- Reveal elements alongside the explanation. Keep labels visible throughout cues.
- Charts require evidence for values. Preserve units, labels, and attribution.
- Never invent percentages or quantities. Without numbers, choose a diagram.
- Prefer editable Fusion elements. Reuse asset and graphics helpers.
- CLEAN runs without content planning. BOOK/TEACH require matching content plans.

## 7. Test and Release

| Stage | Required checks |
|---|---|
| Inspect | Imports, manifests, dependencies, APIs, paths |
| CLEAN | One clip; two clips; join boundary |
| BOOK | Typography, timing, doodles, quotation fidelity |
| TEACH | Diagram timing, labels, chart values, visibility |
| Rerun | No repeated cuts/gain/graphics |
| Failure | Missing media/input; source remains unchanged |
| Persistence | Save, reopen, inspect results |

Use 30–60 second setup samples. Include speech, pauses, and fillers. Include a two-clip join.

**Result table:**
```
MODE | PASS/FAIL/UNTESTED/UNSUPPORTED | EVIDENCE | NEXT ACTION
```

## 8. Sources

- Blackmagic Resolve 21 New Features Guide: https://documents.blackmagicdesign.com/SupportNotes/DaVinci_Resolve_21_New_Features_Guide.pdf
- MagicScript: https://magic-toolkit.com/magicscript
- Blackmagic Resolve 20 New Features Guide: https://documents.blackmagicdesign.com/SupportNotes/DaVinci_Resolve_20_New_Features_Guide.pdf
